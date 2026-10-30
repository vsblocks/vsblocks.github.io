import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import VM from 'scratch-vm';
import {connect} from 'react-redux';

import GitTabComponent from '../components/git-tab/git-tab.jsx';
import errorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import {GitHubClient, gitBlobSha} from '../lib/github-api.js';
import {OAUTH_WORKER_URL, PROJECT_DIR} from '../lib/github-config.js';
import {packProject, unpackProject} from '../lib/project-files.js';
import {normalizedProjectSha} from '../lib/project-hash.js';

import {
    activateTab,
    GIT_TAB_INDEX
} from '../reducers/editor-tab';

const STORAGE_KEY = 'git-tab:config';
const EMPTY_CONFIG = {token: '', repo: '', branch: ''};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const loadConfig = () => {
    try {
        return Object.assign({}, EMPTY_CONFIG, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch (e) {
        return Object.assign({}, EMPTY_CONFIG);
    }
};

const saveConfig = config => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        // localStorage unavailable: carry on without remembering
    }
};

const oauthOrigin = () => {
    try {
        return new URL(OAUTH_WORKER_URL).origin;
    } catch (e) {
        return '';
    }
};

const BRIDGE_KEY = '__gitBlocksBridge';

// The Git tab hands the "Save blocks as image" addon the project.json of the commit being compared;
// the addon highlights in the editor the blocks that have changed since then.
const getBridge = () => {
    window[BRIDGE_KEY] = window[BRIDGE_KEY] || {};
    return window[BRIDGE_KEY];
};
const publishBaseline = baseline => {
    const bridgeState = getBridge();
    bridgeState.baseline = baseline;
    if (!baseline) bridgeState.summary = null;
    window.dispatchEvent(new CustomEvent('git-tab:baseline', {detail: baseline}));
};

class GitTab extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleField',
            'handleLogin',
            'handleTokenLogin',
            'handleOAuthMessage',
            'handleDisconnect',
            'handleSelectRepo',
            'handleChangeRepo',
            'handleCreateRepo',
            'handleRefresh',
            'handleChangeBranch',
            'handleCommit',
            'handleLoadVersion',
            'handleLoadLatest',
            'handleCompare',
            'handleCompareReset',
            'handleBridgeEvent',
            'handleCreateBranch',
            'scheduleDirtyCheck',
            'checkDirty'
        ]);

        const config = loadConfig();
        this.state = {
            token: config.token,
            repo: config.repo,
            branch: config.branch,

            user: null,
            repos: [],
            reposLoaded: false,
            repoFilter: '',
            newRepoName: '',
            newRepoPrivate: true,

            branches: [],
            commits: [],
            headSha: '',
            dirty: null, // null = unknown, true = has uncommitted changes

            commitMessage: '',
            newBranch: '',

            compareSha: '', // '' = compare with the latest commit on the branch
            diffSummary: null, // {added, modified, removed, label}, comes from the addon

            busy: '',
            error: '',
            info: ''
        };

        // sha of project.json at the top of the branch (undefined = not loaded yet, null = doesn't exist there)
        this.remoteJsonSha = undefined;
        // Hash (without positions) of the project right after loading/committing: the editor rewrites project.json
        // with small differences, so comparing against the text saved on GitHub gives false "changes".
        this.cleanSha = null;
        this.cleanForRemote = null; // the GitHub project.json that cleanSha corresponds to
        this.remoteCache = null; // {sha, json, norm} of the project.json at the top of the branch
        this.remoteNorm = undefined; // hash without positions of the top project.json (undefined = unavailable)
        this.compareSha = '';
        this.dirtyTimer = null;
        this.loginPopup = null;
        this.loginPoll = null;
        this.unmounted = false;
    }

    componentDidMount () {
        this.props.vm.runtime.on('PROJECT_CHANGED', this.scheduleDirtyCheck);
        this.props.vm.runtime.on('PROJECT_LOADED', this.scheduleDirtyCheck);
        window.addEventListener('message', this.handleOAuthMessage);
        window.addEventListener('git-tab:diff-summary', this.handleBridgeEvent);
        window.addEventListener('git-tab:suggest-message', this.handleBridgeEvent);
        const bridgeState = getBridge();
        if (bridgeState.summary) this.setState({diffSummary: bridgeState.summary});
        if (bridgeState.pendingMessage) this.applySuggestedMessage(bridgeState.pendingMessage);
        if (this.state.token) {
            this.authenticate(this.state.token);
        }
    }

    componentWillUnmount () {
        this.unmounted = true;
        clearTimeout(this.dirtyTimer);
        clearInterval(this.loginPoll);
        window.removeEventListener('message', this.handleOAuthMessage);
        window.removeEventListener('git-tab:diff-summary', this.handleBridgeEvent);
        window.removeEventListener('git-tab:suggest-message', this.handleBridgeEvent);
        this.props.vm.runtime.off('PROJECT_CHANGED', this.scheduleDirtyCheck);
        this.props.vm.runtime.off('PROJECT_LOADED', this.scheduleDirtyCheck);
    }

    // ---------- helpers ----------

    client () {
        return new GitHubClient(this.state.token, this.state.repo);
    }

    describeError (e) {
        if (e.status === 401) return 'Invalid or expired token. Please sign in again.';
        if (e.status === 409 && /empty/i.test(e.message)) {
            return 'Empty repository: create an initial commit (e.g. a README) on GitHub and try again.';
        }
        if (e.status === 403 || e.status === 404) {
            return `${e.message}. Check that you have access to the repository and that the login/token ` +
                'has write permission on it.';
        }
        return e.message || String(e);
    }

    async run (label, fn) {
        this.setState({busy: label, error: '', info: ''});
        try {
            await fn();
        } catch (e) {
            console.error(e);
            if (!this.unmounted) this.setState({error: this.describeError(e)});
        }
        if (!this.unmounted) this.setState({busy: ''});
    }

    // The open project, unpacked: project.json + images and sounds, all inside PROJECT_DIR/
    async getLocalFiles () {
        const buffer = await this.props.vm.saveProjectSb3('arraybuffer');
        return unpackProject(buffer);
    }

    scheduleDirtyCheck () {
        clearTimeout(this.dirtyTimer);
        this.dirtyTimer = setTimeout(this.checkDirty, 2000);
    }

    localJson () {
        const raw = this.props.vm.toJSON();
        return typeof raw === 'string' ? raw : JSON.stringify(raw);
    }

    // hash of the open project without positions (sprite, scripts, comments and monitors)
    localNorm () {
        return normalizedProjectSha(JSON.parse(this.localJson()));
    }

    // Marks the open project, as the editor serializes it right now, as "equal to the top commit"
    async markClean () {
        try {
            this.cleanSha = await this.localNorm();
            this.cleanForRemote = this.remoteJsonSha;
        } catch (e) {
            console.warn(e);
        }
    }

    async checkDirty () {
        if (this.remoteJsonSha === undefined) return;
        try {
            const local = await this.localNorm();
            // the clean reference is only valid while the top commit is the same as when it was taken
            const cleanIsValid = this.cleanSha !== null && this.cleanForRemote === this.remoteJsonSha;
            let dirty;
            if (cleanIsValid) {
                dirty = local !== this.cleanSha;
            } else if (this.remoteJsonSha === null) {
                dirty = true; // the top commit doesn't even have a project.json
            } else if (this.remoteNorm !== undefined) {
                dirty = local !== this.remoteNorm;
            } else {
                // couldn't download the commit's project.json: compare the text, which is less precise
                const raw = await gitBlobSha(new TextEncoder().encode(this.localJson()));
                dirty = raw !== this.remoteJsonSha;
            }
            if (!this.unmounted) this.setState({dirty});
        } catch (e) {
            console.log(e);
        }
    }

    // project.json at the top of the branch, cached by blob hash (only downloads when the top commit changes)
    async remoteProject (gh, remote) {
        if (this.remoteCache && this.remoteCache.sha === remote.sha) return this.remoteCache;
        const published = getBridge().baseline;
        const reusable = published && published.sha === remote.sha && published.repo === gh.repo;
        const json = reusable ? published.json : await gh.readBlobJson(remote.sha);
        this.remoteCache = {sha: remote.sha, json, norm: await normalizedProjectSha(json)};
        return this.remoteCache;
    }

    async loadRemote (gh, branch, retries = 0) {
        for (let attempt = 0; ; attempt++) {
            try {
                const [branches, commits, head] = await Promise.all([
                    gh.branches(),
                    gh.commits(branch),
                    gh.branchHead(branch)
                ]);
                // project.json lives in PROJECT_DIR/, so go down one folder to find its hash
                const root = await gh.tree(head.object.sha);
                const dir = root.tree.find(t => t.path === PROJECT_DIR && t.type === 'tree');
                let remote = null;
                if (dir) {
                    const inner = await gh.tree(dir.sha);
                    remote = inner.tree.find(t => t.path === 'project.json') || null;
                }
                this.remoteJsonSha = remote ? remote.sha : null;
                try {
                    this.remoteNorm = remote ? (await this.remoteProject(gh, remote)).norm : null;
                } catch (e) {
                    console.warn('Could not download the commit\'s project.json for comparison:', e);
                    this.remoteNorm = undefined;
                }
                await this.syncBaseline(gh, head.object.sha, branch, remote);
                let list = commits;
                if (!list.some(c => c.sha === head.object.sha)) {
                    const top = await gh.getCommit(head.object.sha);
                    list = [{sha: top.sha, commit: {message: top.message, author: top.author}}].concat(list);
                }
                this.setState({
                    branches: branches.map(b => b.name),
                    commits: list,
                    headSha: head.object.sha
                });
                break;
            } catch (e) {
                // newly created repository: the initial commit may take a moment to show up
                if (attempt >= retries || (e.status !== 404 && e.status !== 409)) throw e;
                await wait(1200);
            }
        }
        await this.checkDirty();
    }

    // Hands the addon the project.json of the top commit of the branch (unless the user chose another one)
    async syncBaseline (gh, headSha, branch, remote) {
        if (this.compareSha) return;
        if (!remote) {
            publishBaseline(null);
            return;
        }
        const current = getBridge().baseline;
        if (current && current.sha === remote.sha && current.repo === gh.repo && current.branch === branch) return;
        try {
            const {json} = await this.remoteProject(gh, remote);
            publishBaseline({
                json,
                sha: remote.sha,
                branch,
                repo: gh.repo,
                label: `${headSha.slice(0, 7)} · ${branch}`
            });
        } catch (e) {
            console.warn('Could not load the commit to compare the blocks:', e);
        }
    }

    async loadRepos (token) {
        const repos = await new GitHubClient(token, '').listRepos();
        this.setState({repos, reposLoaded: true});
    }

    async openRepo (token, repo, branch, retries = 0) {
        const gh = new GitHubClient(token, repo);
        const target = branch || (await gh.repoInfo()).default_branch;
        saveConfig({token, repo, branch: target});
        this.remoteJsonSha = undefined;
        this.compareSha = '';
        this.cleanSha = null;
        this.setState({repo, branch: target, branches: [], commits: [], headSha: '', dirty: null, compareSha: ''});
        try {
            await this.loadRemote(gh, target, retries);
        } catch (e) {
            if (!(e.status === 409 && /empty/i.test(e.message))) throw e;
            // empty repository: offer to send the open project as the initial commit
            const ok = window.confirm(
                'This repository is empty.\nSend the open project as the initial commit?'
            );
            if (!ok) throw e;
            const files = await this.getLocalFiles();
            this.setState({busy: 'Sending the project as the initial commit…'});
            await this.createInitialCommit(gh, target, files, true);
            await this.loadRemote(gh, target, 4);
        }
    }

    async waitForBranch (gh, branch) {
        for (let attempt = 0; ; attempt++) {
            try {
                await gh.branchHead(branch);
                return;
            } catch (e) {
                // newly created repository: the branch may take a moment to exist
                if (attempt >= 5 || (e.status !== 404 && e.status !== 409)) throw e;
                await wait(1200);
            }
        }
    }

    // The repository's initial commit becomes the project itself (no README/empty commit before it).
    async createInitialCommit (gh, branch, files, seed) {
        if (seed) await gh.seedEmptyRepo();
        await this.waitForBranch(gh, branch);
        await gh.initialCommit({branch, message: 'Initial commit', files});
    }

    authenticate (token) {
        return this.run('Signing in…', async () => {
            const user = await new GitHubClient(token, '').user();
            const {repo, branch} = this.state;
            saveConfig({token, repo, branch});
            this.setState({user, token});
            if (repo) {
                await this.openRepo(token, repo, branch);
            } else {
                await this.loadRepos(token);
            }
        });
    }

    // ---------- login ----------

    handleField (field, value) {
        this.setState({[field]: value});
    }

    handleLogin () {
        if (!OAUTH_WORKER_URL) {
            this.setState({error: 'Set OAUTH_WORKER_URL in src/lib/github-config.js (or sign in with a token).'});
            return;
        }
        const url = `${OAUTH_WORKER_URL.replace(/\/$/, '')}/login` +
            `?origin=${encodeURIComponent(window.location.origin)}`;
        const width = 600;
        const height = 720;
        const left = Math.round(window.screenX + ((window.outerWidth - width) / 2));
        const top = Math.round(window.screenY + ((window.outerHeight - height) / 2));
        this.loginPopup = window.open(
            url,
            'github-login',
            `width=${width},height=${height},left=${left},top=${top}`
        );
        if (!this.loginPopup) {
            this.setState({error: 'The browser blocked the login window. Allow popups and try again.'});
            return;
        }
        this.setState({busy: 'Waiting for GitHub login…', error: '', info: ''});
        clearInterval(this.loginPoll);
        this.loginPoll = setInterval(() => {
            if (this.loginPopup && this.loginPopup.closed) {
                clearInterval(this.loginPoll);
                if (!this.unmounted && this.state.busy.startsWith('Waiting')) {
                    this.setState({busy: ''});
                }
            }
        }, 500);
    }

    handleOAuthMessage (event) {
        const expected = oauthOrigin();
        if (!expected || event.origin !== expected) return;
        const data = event.data || {};
        if (data.type !== 'github-oauth') return;

        clearInterval(this.loginPoll);
        if (data.error || !data.token) {
            this.setState({busy: '', error: `Login not completed: ${data.error || 'no token'}`});
            return;
        }
        this.authenticate(data.token);
    }

    handleTokenLogin () {
        const token = this.state.token.trim();
        if (!token) {
            this.setState({error: 'Paste a personal access token.'});
            return null;
        }
        return this.authenticate(token);
    }

    handleDisconnect () {
        saveConfig(EMPTY_CONFIG);
        this.remoteJsonSha = undefined;
        this.cleanSha = null;
        this.compareSha = '';
        publishBaseline(null);
        this.setState({
            token: '',
            repo: '',
            branch: '',
            user: null,
            repos: [],
            reposLoaded: false,
            repoFilter: '',
            branches: [],
            commits: [],
            headSha: '',
            dirty: null,
            compareSha: '',
            diffSummary: null,
            error: '',
            info: ''
        });
    }

    // ---------- repositories ----------

    handleSelectRepo (fullName, defaultBranch) {
        return this.run('Opening repository…', () => this.openRepo(this.state.token, fullName, defaultBranch));
    }

    handleChangeRepo () {
        saveConfig({token: this.state.token, repo: '', branch: ''});
        this.remoteJsonSha = undefined;
        this.compareSha = '';
        publishBaseline(null);
        this.setState({
            repo: '',
            branch: '',
            branches: [],
            commits: [],
            headSha: '',
            dirty: null,
            compareSha: '',
            diffSummary: null,
            error: '',
            info: ''
        });
        if (!this.state.reposLoaded) {
            return this.run('Loading repositories…', () => this.loadRepos(this.state.token));
        }
        return null;
    }

    handleCreateRepo () {
        const name = this.state.newRepoName.trim();
        if (!/^[\w.-]+$/.test(name)) {
            this.setState({error: 'Invalid name (use letters, numbers, ".", "_" and "-", no spaces).'});
            return null;
        }
        return this.run('Creating repository…', async () => {
            // read the project first: if that fails, the repository never gets created
            const files = await this.getLocalFiles();
            const created = await new GitHubClient(this.state.token, '')
                .createRepo(name, this.state.newRepoPrivate);
            this.setState({newRepoName: '', repos: [], reposLoaded: false});

            const gh = new GitHubClient(this.state.token, created.full_name);
            let info = `Repository ${created.full_name} created with the project as the initial commit.`;
            this.setState({busy: 'Sending the project as the initial commit…'});
            try {
                await this.createInitialCommit(gh, created.default_branch, files, false);
            } catch (e) {
                console.error(e);
                info = '';
                this.setState({
                    error: `The repository was created, but the initial commit failed: ${this.describeError(e)} ` +
                        'Use "Commit" to send the project.'
                });
            }
            if (info) this.setState({info});
            await this.openRepo(this.state.token, created.full_name, created.default_branch, 4);
        });
    }

    // ---------- git ----------

    handleRefresh () {
        return this.run('Refreshing…', () => this.loadRemote(this.client(), this.state.branch));
    }

    handleChangeBranch (branch) {
        saveConfig({token: this.state.token, repo: this.state.repo, branch});
        this.compareSha = '';
        this.setState({branch, compareSha: ''});
        return this.run('Switching branch…', () => this.loadRemote(this.client(), branch));
    }

    handleCommit () {
        const message = this.state.commitMessage.trim();
        if (!message) {
            this.setState({error: 'Write a commit message.'});
            return null;
        }
        const {branch, headSha} = this.state;
        return this.run('Sending commit…', async () => {
            const gh = this.client();
            const files = await this.getLocalFiles();
            const result = await gh.commitFiles({
                branch,
                message,
                files,
                prefix: PROJECT_DIR,
                expectedHead: headSha
            });
            if (!result.commit) {
                this.setState({info: 'Nothing has changed since the last commit.'});
                return;
            }
            const removedText = result.removed ? `, ${result.removed} removed` : '';
            // Update the screen right away with what GitHub just returned (GitHub's commit list
            // can take a few seconds to include the new commit).
            const newCommit = {
                sha: result.commit.sha,
                commit: {message: result.commit.message, author: result.commit.author}
            };
            const projectJson = files.find(f => f.path === `${PROJECT_DIR}/project.json`);
            this.remoteJsonSha = projectJson ? await gitBlobSha(projectJson.bytes) : this.remoteJsonSha;
            await this.markClean();
            this.setState(prev => ({
                commitMessage: '',
                headSha: newCommit.sha,
                commits: [newCommit].concat(prev.commits),
                info: `Commit ${newCommit.sha.slice(0, 7)} sent to ${branch}: ` +
                    `${result.uploaded} new or changed file(s)${removedText}.`
            }));
            // the commit that just went out becomes the reference: the "unsaved" highlights disappear
            if (projectJson) {
                try {
                    publishBaseline({
                        json: JSON.parse(this.localJson()),
                        sha: this.remoteJsonSha,
                        branch,
                        repo: gh.repo,
                        label: `${newCommit.sha.slice(0, 7)} · ${branch}`
                    });
                } catch (e) {
                    console.warn(e);
                }
            }
            this.compareSha = '';
            this.setState({compareSha: ''});
            await this.checkDirty();
        });
    }

    async loadProjectAt (sha, label) {
        const files = await this.client().readProjectFiles(sha, PROJECT_DIR, (done, total) => {
            this.setState({busy: `Downloading files ${done}/${total}…`});
        });
        const buffer = await packProject(files);
        await this.props.vm.loadProject(buffer);

        // If what was just loaded is the same project.json as the top commit, there is no change at all:
        // keep the current serialization as the reference (the editor rewrites the JSON on load, so comparing
        // with the text on GitHub would point out differences that don't exist).
        const loadedJson = files.find(f => f.path === 'project.json');
        const sameAsTop = !!loadedJson && (await gitBlobSha(loadedJson.bytes)) === this.remoteJsonSha;
        if (sameAsTop) {
            await wait(700); // let the editor finish adjusting the freshly loaded project
            await this.markClean();
            if (!this.compareSha) {
                try {
                    publishBaseline({
                        json: JSON.parse(this.localJson()),
                        sha: this.remoteJsonSha,
                        branch: this.state.branch,
                        repo: this.state.repo,
                        label: `${this.state.headSha.slice(0, 7)} · ${this.state.branch}`
                    });
                } catch (e) {
                    console.warn(e);
                }
            }
        }
        this.setState({info: `Version ${label} loaded into the editor.`});
        await this.checkDirty();
    }

    // Only asks when there is something to lose: if the open project is equal to the last commit, or has
    // never been edited since the editor opened, loading doesn't throw anything away.
    confirmReplace (label) {
        const hasUnsaved = this.state.dirty !== false && this.props.projectChanged !== false;
        if (!hasUnsaved) return true;
        return window.confirm(
            `Load "${label}"?\nThe open project has changes that were not committed and will be lost.`
        );
    }

    handleLoadVersion (sha, label) {
        if (!this.confirmReplace(label)) return null;
        return this.run('Loading version…', () => this.loadProjectAt(sha, label));
    }

    // "Download latest": asks GitHub which commit is at the top right now, instead of trusting the list on screen
    handleLoadLatest () {
        const {branch} = this.state;
        const label = `latest commit of ${branch}`;
        if (!this.confirmReplace(label)) return null;
        return this.run('Fetching the latest commit…', async () => {
            const gh = this.client();
            const head = (await gh.branchHead(branch)).object.sha;
            await this.loadRemote(gh, branch);
            await this.loadProjectAt(head, label);
        });
    }

    // "Compare": the addon starts highlighting what changed in the open project relative to this commit
    handleCompare (sha) {
        return this.run('Loading the commit to compare…', async () => {
            const json = await this.client().readProjectJson(sha, PROJECT_DIR);
            this.compareSha = sha;
            publishBaseline({
                json,
                commit: sha,
                branch: this.state.branch,
                repo: this.state.repo,
                label: `${sha.slice(0, 7)} (comparison)`
            });
            this.setState({
                compareSha: sha,
                info: `Comparing the open project with commit ${sha.slice(0, 7)}. ` +
                    'Open the code tab to see the highlighted blocks.'
            });
        });
    }

    handleCompareReset () {
        this.compareSha = '';
        this.setState({compareSha: ''});
        getBridge().baseline = null; // forces syncBaseline to hand over the latest commit again
        return this.run('Going back to the latest commit…', () => this.loadRemote(this.client(), this.state.branch));
    }

    applySuggestedMessage (text) {
        getBridge().pendingMessage = null;
        if (!text) return;
        this.setState(prev => ({
            commitMessage: prev.commitMessage.trim() ? `${prev.commitMessage}\n${text}` : text,
            info: 'Message suggested from the changes in the blocks.'
        }));
    }

    handleBridgeEvent (event) {
        if (event.type === 'git-tab:diff-summary') {
            this.setState({diffSummary: event.detail || null});
        } else if (event.type === 'git-tab:suggest-message' && event.detail) {
            this.applySuggestedMessage(event.detail.text);
        }
    }

    handleCreateBranch () {
        const name = this.state.newBranch.trim();
        if (!/^[\w./-]+$/.test(name)) {
            this.setState({error: 'Invalid branch name (use letters, numbers, ".", "_", "-" and "/").'});
            return null;
        }
        return this.run('Creating branch…', async () => {
            const gh = this.client();
            await gh.createBranch(name, this.state.headSha);
            saveConfig({token: this.state.token, repo: this.state.repo, branch: name});
            this.setState({branch: name, newBranch: '', info: `Branch ${name} created from the current commit.`});
            await this.loadRemote(gh, name);
        });
    }

    render () {
        return (
            <GitTabComponent
                {...this.props}
                oauthReady={!!OAUTH_WORKER_URL}
                token={this.state.token}
                repo={this.state.repo}
                branch={this.state.branch}
                user={this.state.user}
                repos={this.state.repos}
                reposLoaded={this.state.reposLoaded}
                repoFilter={this.state.repoFilter}
                newRepoName={this.state.newRepoName}
                newRepoPrivate={this.state.newRepoPrivate}
                branches={this.state.branches}
                commits={this.state.commits}
                headSha={this.state.headSha}
                dirty={this.state.dirty}
                commitMessage={this.state.commitMessage}
                newBranch={this.state.newBranch}
                busy={this.state.busy}
                error={this.state.error}
                info={this.state.info}
                compareSha={this.state.compareSha}
                diffSummary={this.state.diffSummary}
                onField={this.handleField}
                onLogin={this.handleLogin}
                onTokenLogin={this.handleTokenLogin}
                onDisconnect={this.handleDisconnect}
                onSelectRepo={this.handleSelectRepo}
                onChangeRepo={this.handleChangeRepo}
                onCreateRepo={this.handleCreateRepo}
                onRefresh={this.handleRefresh}
                onChangeBranch={this.handleChangeBranch}
                onCommit={this.handleCommit}
                onLoadVersion={this.handleLoadVersion}
                onLoadLatest={this.handleLoadLatest}
                onCompare={this.handleCompare}
                onCompareReset={this.handleCompareReset}
                onCreateBranch={this.handleCreateBranch}
            />
        );
    }
}

GitTab.propTypes = {
    isRtl: PropTypes.bool,
    projectChanged: PropTypes.bool,
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    isRtl: state.locales.isRtl,
    projectChanged: state.scratchGui.projectChanged
});

const mapDispatchToProps = dispatch => ({
    onActivateGitTab: () => dispatch(activateTab(GIT_TAB_INDEX))
});

export default errorBoundaryHOC('Git Tab')(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(GitTab)
);