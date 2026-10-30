import {gitBlobSha} from './github-api.js';

// Posição não conta como mudança: onde o sprite está no palco (x, y), onde os scripts, comentários e
// monitores estão na tela. Mover essas coisas, ou rodar o projeto (que move sprites), não deixa o
// projeto "com mudanças não salvas".

const withoutXY = obj => {
    const copy = Object.assign({}, obj);
    delete copy.x;
    delete copy.y;
    return copy;
};

const mapValues = (obj, fn) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    Object.keys(obj).forEach(key => {
        out[key] = fn(obj[key]);
    });
    return out;
};

// bloco solto no topo: objeto com x/y, ou lista [tipo, nome, id, x, y] (variável/lista fora de encaixe)
const stripBlock = block => {
    if (Array.isArray(block)) return block.length >= 5 ? block.slice(0, 3) : block;
    return block && typeof block === 'object' ? withoutXY(block) : block;
};

export const stripPositions = project => Object.assign({}, project, {
    targets: (project.targets || []).map(target => Object.assign(withoutXY(target), {
        blocks: mapValues(target.blocks, stripBlock),
        comments: mapValues(target.comments, withoutXY)
    })),
    monitors: (project.monitors || []).map(withoutXY)
});

// JSON com as chaves em ordem fixa, para a ordem em que o editor escreve os campos não importar
const stable = value => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort()
            .map(key => `${JSON.stringify(key)}:${stable(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value === undefined ? null : value);
};

/**
 * Hash do projeto sem as posições. Dois projetos iguais, só com coisas em lugares diferentes, dão o mesmo hash.
 * @param {object} project project.json já convertido em objeto
 * @returns {Promise<string>} hash em hexadecimal
 */
export const normalizedProjectSha = project =>
    gitBlobSha(new TextEncoder().encode(stable(stripPositions(project))));