import JSZip from 'jszip'; // se o seu fork não tiver: npm install jszip
import {PROJECT_DIR} from './github-config.js';

/**
 * Abre o .sb3/.pmp (que é um zip) e devolve os arquivos soltos, já com o caminho dentro de PROJECT_DIR.
 * @param {ArrayBuffer} arrayBuffer o projeto empacotado
 * @returns {Promise<Array<{path: string, bytes: Uint8Array}>>} arquivos descompactados
 */
export const unpackProject = async arrayBuffer => {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const files = [];
    for (const name of Object.keys(zip.files)) {
        const entry = zip.files[name];
        if (entry.dir || name.split('/').includes('..')) continue;
        files.push({path: `${PROJECT_DIR}/${name}`, bytes: await entry.async('uint8array')});
    }
    if (!files.some(f => f.path === `${PROJECT_DIR}/project.json`)) {
        throw new Error('O projeto salvo não tem project.json.');
    }
    return files;
};

/**
 * Faz o caminho inverso: junta os arquivos soltos (caminhos relativos a PROJECT_DIR) em um zip
 * que o editor consegue carregar como .sb3/.pmp.
 * @param {Array<{path: string, bytes: Uint8Array}>} files arquivos do projeto
 * @returns {Promise<ArrayBuffer>} o projeto empacotado
 */
export const packProject = async files => {
    if (!files.some(f => f.path === 'project.json')) {
        throw new Error(`Esse commit não tem ${PROJECT_DIR}/project.json.`);
    }
    const zip = new JSZip();
    // project.json primeiro, como o editor costuma salvar
    const ordered = files.slice().sort((a, b) => (b.path === 'project.json') - (a.path === 'project.json'));
    ordered.forEach(f => zip.file(f.path, f.bytes));
    return zip.generateAsync({type: 'arraybuffer', compression: 'DEFLATE'});
};