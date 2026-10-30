const API = 'https://api.github.com';

const encodeRef = name => name.split('/').map(encodeURIComponent)
    .join('/');

const toBase64 = bytes => {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
};

/**
 * SHA-1 de um blob do git ("blob <tamanho>\0<conteúdo>").
 * Dá o mesmo hash que o GitHub mostra, então dá pra comparar sem baixar nada.
 * (crypto.subtle só existe em https ou localhost)
 * @param {Uint8Array} bytes conteúdo do arquivo
 * @returns {Promise<string>} sha em hexadecimal
 */
export const gitBlobSha = async bytes => {
    const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
    const all = new Uint8Array(header.length + bytes.length);
    all.set(header, 0);
    all.set(bytes, header.length);
    const digest = await crypto.subtle.digest('SHA-1', all);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * Roda fn em todos os itens, no máximo `limit` ao mesmo tempo (evita estourar o limite do GitHub).
 * @param {Array} items itens
 * @param {number} limit quantos em paralelo
 * @param {Function} fn async (item, index) => resultado
 * @returns {Promise<Array>} resultados na mesma ordem dos itens
 */
export const pool = async (items, limit, fn) => {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await fn(items[index], index);
        }
    };
    await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
    return results;
};

export class GitHubClient {
    constructor (token, repo) {
        this.token = token;
        this.repo = repo; // "dono/nome"
    }

    async request (path, {method = 'GET', body, raw = false} = {}) {
        const headers = {
            Authorization: `Bearer ${this.token}`,
            Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
        if (body) headers['Content-Type'] = 'application/json';

        const res = await fetch(`${API}${path}`, {
            method,
            headers,
            // A API do GitHub responde com "max-age=60": sem isto o navegador reaproveita a resposta
            // antiga e o commit recém-feito não aparece (nem o HEAD novo) por cerca de 1 minuto.
            cache: 'no-store',
            body: body ? JSON.stringify(body) : undefined
        });
        if (!res.ok) {
            let message = res.statusText;
            try {
                message = (await res.json()).message || message;
            } catch (e) {
                // sem corpo JSON
            }
            const err = new Error(message);
            err.status = res.status;
            throw err;
        }
        if (raw) return res.arrayBuffer();
        if (res.status === 204) return null;
        return res.json();
    }

    user () {
        return this.request('/user');
    }

    repoInfo () {
        return this.request(`/repos/${this.repo}`);
    }

    /**
     * Repositórios que o usuário pode acessar (próprios, de colaboração e de organizações),
     * do mais recentemente alterado para o mais antigo. Até 5 páginas de 100.
     * @returns {Promise<Array<object>>} lista de repositórios
     */
    async listRepos () {
        const all = [];
        for (let page = 1; page <= 5; page++) {
            const chunk = await this.request(
                `/user/repos?per_page=100&page=${page}&sort=pushed` +
                '&affiliation=owner,collaborator,organization_member'
            );
            all.push(...chunk);
            if (chunk.length < 100) break;
        }
        return all;
    }

    /**
     * Cria um repositório já com um commit inicial (README), para o commit do projeto funcionar de cara.
     * @param {string} name nome do repositório
     * @param {boolean} isPrivate se é privado
     * @returns {Promise<object>} o repositório criado
     */
    createRepo (name, isPrivate) {
        return this.request('/user/repos', {
            method: 'POST',
            body: {name, private: !!isPrivate, auto_init: true}
        });
    }

    branches () {
        return this.request(`/repos/${this.repo}/branches?per_page=100`);
    }

    branchHead (branch) {
        return this.request(`/repos/${this.repo}/git/ref/heads/${encodeRef(branch)}`);
    }

    commits (branch) {
        return this.request(`/repos/${this.repo}/commits?sha=${encodeURIComponent(branch)}&per_page=30`);
    }

    // project.json de um commit, já convertido em objeto (usado para comparar os blocos)
    async readBlobJson (sha) {
        const buffer = await this.request(`/repos/${this.repo}/git/blobs/${sha}`, {raw: true});
        return JSON.parse(new TextDecoder().decode(buffer));
    }

    async readProjectJson (commitSha, prefix) {
        const commit = await this.getCommit(commitSha);
        const root = await this.tree(commit.tree.sha);
        const dir = root.tree.find(t => t.path === prefix && t.type === 'tree');
        if (!dir) throw new Error(`Esse commit não tem a pasta "${prefix}/".`);
        const inner = await this.tree(dir.sha);
        const file = inner.tree.find(t => t.path === 'project.json');
        if (!file) throw new Error(`Esse commit não tem ${prefix}/project.json.`);
        return this.readBlobJson(file.sha);
    }

    getCommit (sha) {
        return this.request(`/repos/${this.repo}/git/commits/${sha}`);
    }

    tree (sha) {
        return this.request(`/repos/${this.repo}/git/trees/${sha}`);
    }

    readFile (path, ref) {
        return this.request(`/repos/${this.repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, {raw: true});
    }

    createBranch (name, fromSha) {
        return this.request(`/repos/${this.repo}/git/refs`, {
            method: 'POST',
            body: {ref: `refs/heads/${name}`, sha: fromSha}
        });
    }

    /**
     * Repositório vazio não aceita a API de blobs/trees. Um único arquivo pela API de conteúdo
     * cria o primeiro commit e a branch padrão; depois initialCommit troca esse commit pelo do projeto.
     * @returns {Promise<object>} resposta do GitHub
     */
    seedEmptyRepo () {
        return this.request(`/repos/${this.repo}/contents/.gitkeep`, {
            method: 'PUT',
            body: {message: 'Inicializa o repositório', content: 'Cg=='}
        });
    }

    /**
     * Faz o projeto virar o commit inicial: cria um commit SEM pai, só com os arquivos do projeto,
     * e aponta a branch para ele (force). O commit "vazio"/README que veio da criação do repositório
     * fica de fora do histórico. Só use em repositório recém-criado ou vazio.
     * @param {object} opts opções
     * @param {string} opts.branch branch padrão do repositório
     * @param {string} opts.message mensagem do commit
     * @param {Array<{path: string, bytes: Uint8Array}>} opts.files arquivos (caminho completo no repositório)
     * @returns {Promise<object>} o commit criado
     */
    async initialCommit ({branch, message, files}) {
        const entries = await pool(files, 4, async file => {
            const blob = await this.request(`/repos/${this.repo}/git/blobs`, {
                method: 'POST',
                body: {content: toBase64(file.bytes), encoding: 'base64'}
            });
            return {path: file.path, mode: '100644', type: 'blob', sha: blob.sha};
        });
        const tree = await this.request(`/repos/${this.repo}/git/trees`, {
            method: 'POST',
            body: {tree: entries}
        });
        const commit = await this.request(`/repos/${this.repo}/git/commits`, {
            method: 'POST',
            body: {message, tree: tree.sha, parents: []}
        });
        await this.request(`/repos/${this.repo}/git/refs/heads/${encodeRef(branch)}`, {
            method: 'PATCH',
            body: {sha: commit.sha, force: true}
        });
        return commit;
    }

    /**
     * Baixa todos os arquivos de `prefix/` em um commit.
     * @param {string} commitSha commit
     * @param {string} prefix pasta do projeto no repositório
     * @param {Function} [onProgress] (feitos, total)
     * @returns {Promise<Array<{path: string, bytes: Uint8Array}>>} arquivos, com caminho relativo a `prefix`
     */
    async readProjectFiles (commitSha, prefix, onProgress) {
        const commit = await this.request(`/repos/${this.repo}/git/commits/${commitSha}`);
        const tree = await this.request(`/repos/${this.repo}/git/trees/${commit.tree.sha}?recursive=1`);
        if (tree.truncated) throw new Error('O repositório é grande demais para listar os arquivos pela API.');

        const entries = tree.tree.filter(e => e.type === 'blob' && e.path.startsWith(`${prefix}/`));
        if (!entries.length) throw new Error(`Esse commit não tem a pasta "${prefix}/".`);

        let done = 0;
        return pool(entries, 6, async entry => {
            const bytes = new Uint8Array(await this.request(
                `/repos/${this.repo}/git/blobs/${entry.sha}`,
                {raw: true}
            ));
            done += 1;
            if (onProgress) onProgress(done, entries.length);
            return {path: entry.path.slice(prefix.length + 1), bytes};
        });
    }

    /**
     * Cria um commit com vários arquivos de uma vez (blobs -> tree -> commit -> ref).
     * Só envia o que mudou e apaga, dentro de `prefix/`, o que não existe mais em `files`.
     * @param {object} opts opções
     * @param {string} opts.branch branch que recebe o commit
     * @param {string} opts.message mensagem do commit
     * @param {Array<{path: string, bytes: Uint8Array}>} opts.files arquivos (caminho completo no repositório)
     * @param {string} opts.prefix pasta que pertence ao projeto
     * @param {string} [opts.expectedHead] commit que o usuário viu por último; se a branch andou, recusa
     * @returns {Promise<object>} {commit (null se nada mudou), uploaded, removed, unchanged}
     */
    async commitFiles ({branch, message, files, prefix, expectedHead}) {
        const head = (await this.branchHead(branch)).object.sha;
        if (expectedHead && expectedHead !== head) {
            const err = new Error('A branch mudou no GitHub desde a última atualização. ' +
                'Atualize (e carregue a última versão, se quiser) antes de commitar.');
            err.status = 409;
            throw err;
        }

        const headCommit = await this.request(`/repos/${this.repo}/git/commits/${head}`);
        const remote = await this.request(`/repos/${this.repo}/git/trees/${headCommit.tree.sha}?recursive=1`);
        if (remote.truncated) throw new Error('O repositório é grande demais para comparar os arquivos pela API.');

        const remoteShas = new Map();
        remote.tree.forEach(e => {
            if (e.type === 'blob' && e.path.startsWith(`${prefix}/`)) remoteShas.set(e.path, e.sha);
        });

        const localPaths = new Set(files.map(f => f.path));
        const changed = [];
        for (const file of files) {
            const sha = await gitBlobSha(file.bytes);
            if (remoteShas.get(file.path) !== sha) changed.push(file);
        }
        const removed = Array.from(remoteShas.keys()).filter(path => !localPaths.has(path));

        if (!changed.length && !removed.length) {
            return {commit: null, uploaded: 0, removed: 0, unchanged: files.length};
        }

        const entries = await pool(changed, 4, async file => {
            const blob = await this.request(`/repos/${this.repo}/git/blobs`, {
                method: 'POST',
                body: {content: toBase64(file.bytes), encoding: 'base64'}
            });
            return {path: file.path, mode: '100644', type: 'blob', sha: blob.sha};
        });
        removed.forEach(path => entries.push({path, mode: '100644', type: 'blob', sha: null}));

        const newTree = await this.request(`/repos/${this.repo}/git/trees`, {
            method: 'POST',
            body: {base_tree: headCommit.tree.sha, tree: entries}
        });
        const commit = await this.request(`/repos/${this.repo}/git/commits`, {
            method: 'POST',
            body: {message, tree: newTree.sha, parents: [head]}
        });
        await this.request(`/repos/${this.repo}/git/refs/heads/${encodeRef(branch)}`, {
            method: 'PATCH',
            body: {sha: commit.sha}
        });
        return {
            commit,
            uploaded: changed.length,
            removed: removed.length,
            unchanged: files.length - changed.length
        };
    }
}