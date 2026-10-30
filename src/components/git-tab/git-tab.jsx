import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import styles from './git-tab.css';

const firstLine = text => (text || '').split('\n')[0];

const formatDate = iso => (iso ? new Date(iso).toLocaleDateString() : '');

/* ---------- icons (custom SVG, inherit the text color) ---------- */

const GitHubMark = ({size = 20}) => (
    <svg
        aria-hidden="true"
        fill="currentColor"
        height={size}
        viewBox="0 0 16 16"
        width={size}
    >
        <path
            d={'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'}
        />
    </svg>
);
GitHubMark.propTypes = {size: PropTypes.number};

const LockIcon = () => (
    <svg
        aria-label="Private"
        fill="none"
        height="14"
        role="img"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
        viewBox="0 0 16 16"
        width="14"
    >
        <rect
            height="7"
            rx="1.5"
            width="10"
            x="3"
            y="7.5"
        />
        <path d="M5.5 7.5V5.5a2.5 2.5 0 015 0v2" />
    </svg>
);

const BranchIcon = () => (
    <svg
        aria-hidden="true"
        fill="none"
        height="14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
        viewBox="0 0 16 16"
        width="14"
    >
        <circle
            cx="4"
            cy="3"
            r="1.6"
        />
        <circle
            cx="4"
            cy="13"
            r="1.6"
        />
        <circle
            cx="12"
            cy="5.5"
            r="1.6"
        />
        <path d="M4 4.6v6.8M12 7.1c0 3.2-8 2.2-8 4.3" />
    </svg>
);

/* ---------- pieces ---------- */

const Messages = ({busy, error, info}) => (
    <React.Fragment>
        {busy ? (
            <div className={classNames(styles.message, styles.messageBusy)}>
                <span className={styles.spinner} />
                {busy}
            </div>
        ) : null}
        {error ? <div className={classNames(styles.message, styles.messageError)}>{error}</div> : null}
        {info ? <div className={classNames(styles.message, styles.messageInfo)}>{info}</div> : null}
    </React.Fragment>
);
Messages.propTypes = {busy: PropTypes.string, error: PropTypes.string, info: PropTypes.string};

const UserBar = ({user, onDisconnect}) => (
    <div className={styles.userBar}>
        <img
            alt=""
            className={styles.avatar}
            src={user.avatar_url}
        />
        <div className={styles.grow}>
            <div className={styles.userName}>{user.name || user.login}</div>
            <div className={styles.muted}>{'@'}{user.login}</div>
        </div>
        <button
            className={styles.buttonSecondary}
            onClick={onDisconnect}
        >
            {'Sign out'}
        </button>
    </div>
);
UserBar.propTypes = {
    user: PropTypes.shape({
        avatar_url: PropTypes.string,
        login: PropTypes.string,
        name: PropTypes.string
    }),
    onDisconnect: PropTypes.func
};

/* ---------- screens ---------- */

const LoginScreen = props => {
    const {oauthReady, token, busy, onField, onLogin, onTokenLogin} = props;
    return (
        <section className={styles.hero}>
            <div className={styles.heroMark}><GitHubMark size={40} /></div>
            <h2 className={styles.heroTitle}>{'Keep your projects on GitHub'}</h2>
            <p className={styles.heroText}>
                {'Sign in with your account to choose a repository, save versions of your project as commits, and go back to any of them.'}
            </p>
            <button
                className={styles.buttonGithub}
                disabled={!!busy || !oauthReady}
                onClick={onLogin}
            >
                <GitHubMark />
                {'Sign in with GitHub'}
            </button>
            {oauthReady ? null : (
                <p className={styles.muted}>
                    {'GitHub login has not been set up in this editor yet. Use a token below.'}
                </p>
            )}
            <details className={styles.details}>
                <summary>{'Use a personal token'}</summary>
                <div className={styles.detailsBody}>
                    <input
                        autoComplete="off"
                        className={styles.input}
                        placeholder="github_pat_…"
                        type="password"
                        value={token}
                        onChange={e => onField('token', e.target.value)}
                    />
                    <p className={styles.muted}>
                        {'Requires the "Contents: Read and write" permission on the repositories you want to use.'}
                    </p>
                    <button
                        className={styles.buttonPrimary}
                        disabled={!!busy || !token.trim()}
                        onClick={onTokenLogin}
                    >
                        {'Sign in with token'}
                    </button>
                </div>
            </details>
        </section>
    );
};
LoginScreen.propTypes = {
    oauthReady: PropTypes.bool,
    token: PropTypes.string,
    busy: PropTypes.string,
    onField: PropTypes.func,
    onLogin: PropTypes.func,
    onTokenLogin: PropTypes.func
};

const RepoPicker = props => {
    const {
        user, repos, reposLoaded, repoFilter, newRepoName, newRepoPrivate, busy,
        onField, onDisconnect, onSelectRepo, onCreateRepo
    } = props;

    const query = repoFilter.trim().toLowerCase();
    const shown = repos.filter(r => r.full_name.toLowerCase().includes(query));

    return (
        <React.Fragment>
            <UserBar
                user={user}
                onDisconnect={onDisconnect}
            />

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{'Choose a repository'}</h2>
                <input
                    className={styles.input}
                    placeholder="Search repositories…"
                    type="search"
                    value={repoFilter}
                    onChange={e => onField('repoFilter', e.target.value)}
                />
                <ul className={styles.repoList}>
                    {shown.map(r => (
                        <li key={r.id}>
                            <button
                                className={styles.repoItem}
                                disabled={!!busy}
                                onClick={() => onSelectRepo(r.full_name, r.default_branch)}
                            >
                                <span className={styles.repoItemName}>
                                    {r.full_name}
                                    {r.private ? <LockIcon /> : null}
                                </span>
                                {r.description ? (
                                    <span className={styles.repoItemDesc}>{r.description}</span>
                                ) : null}
                                <span className={styles.muted}>{'Updated on '}{formatDate(r.pushed_at)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
                {reposLoaded && !shown.length ? (
                    <p className={styles.muted}>
                        {repos.length ? 'No repository with that name.' : 'You don\'t have any repositories yet.'}
                    </p>
                ) : null}
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{'New repository'}</h2>
                <input
                    className={styles.input}
                    placeholder="project-name"
                    type="text"
                    value={newRepoName}
                    onChange={e => onField('newRepoName', e.target.value)}
                />
                <label className={styles.check}>
                    <input
                        checked={newRepoPrivate}
                        type="checkbox"
                        onChange={e => onField('newRepoPrivate', e.target.checked)}
                    />
                    {'Private'}
                </label>
                <button
                    className={styles.buttonPrimary}
                    disabled={!!busy || !newRepoName.trim()}
                    onClick={onCreateRepo}
                >
                    {'Create and open'}
                </button>
            </section>
        </React.Fragment>
    );
};
RepoPicker.propTypes = {
    user: PropTypes.object,
    repos: PropTypes.arrayOf(PropTypes.object),
    reposLoaded: PropTypes.bool,
    repoFilter: PropTypes.string,
    newRepoName: PropTypes.string,
    newRepoPrivate: PropTypes.bool,
    busy: PropTypes.string,
    onField: PropTypes.func,
    onDisconnect: PropTypes.func,
    onSelectRepo: PropTypes.func,
    onCreateRepo: PropTypes.func
};

const RepoPanel = props => {
    const {
        user, repo, branch, branches, commits, headSha, dirty, commitMessage, newBranch, busy,
        diffSummary, compareSha,
        onField, onDisconnect, onChangeRepo, onRefresh, onChangeBranch, onCommit, onLoadVersion, onLoadLatest, onCreateBranch,
        onCompare, onCompareReset
    } = props;
    const disabled = !!busy;

    return (
        <React.Fragment>
            <UserBar
                user={user}
                onDisconnect={onDisconnect}
            />

            <section className={styles.card}>
                <div className={styles.row}>
                    <div className={styles.grow}>
                        <div className={styles.muted}>{'Repository'}</div>
                        <div className={styles.repoTitle}>{repo}</div>
                    </div>
                    <button
                        className={styles.buttonSecondary}
                        disabled={disabled}
                        onClick={onRefresh}
                    >
                        {'Refresh'}
                    </button>
                    <button
                        className={styles.buttonSecondary}
                        disabled={disabled}
                        onClick={onChangeRepo}
                    >
                        {'Change'}
                    </button>
                </div>

                <div className={styles.row}>
                    <span className={styles.branchLabel}>
                        <BranchIcon />
                        {'Branch'}
                    </span>
                    <select
                        className={classNames(styles.input, styles.grow)}
                        disabled={disabled}
                        value={branch}
                        onChange={e => onChangeBranch(e.target.value)}
                    >
                        {branches.map(name => (
                            <option
                                key={name}
                                value={name}
                            >{name}</option>
                        ))}
                    </select>
                </div>
                <div className={styles.row}>
                    <input
                        className={classNames(styles.input, styles.grow)}
                        placeholder="new-branch"
                        type="text"
                        value={newBranch}
                        onChange={e => onField('newBranch', e.target.value)}
                    />
                    <button
                        className={styles.buttonSecondary}
                        disabled={disabled || !newBranch.trim()}
                        onClick={onCreateBranch}
                    >
                        {'Create branch'}
                    </button>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.row}>
                    <h2 className={classNames(styles.cardTitle, styles.grow)}>{'Save version'}</h2>
                    {dirty === null ? null : (
                        <span
                            className={classNames(styles.pill, dirty ? styles.pillDirty : styles.pillClean)}
                        >
                            {dirty ? 'Unsaved changes' : 'All saved'}
                        </span>
                    )}
                </div>
                <textarea
                    className={classNames(styles.input, styles.textarea)}
                    placeholder="What changed in this version?"
                    rows={3}
                    value={commitMessage}
                    onChange={e => onField('commitMessage', e.target.value)}
                />
                <button
                    className={styles.buttonPrimary}
                    disabled={disabled || !commitMessage.trim()}
                    onClick={onCommit}
                >
                    {`Commit to ${branch}`}
                </button>
                <p className={styles.muted}>
                    {'Sends the unpacked project, in the project/ folder: project.json and the loose images and sounds. Only what changed is sent.'}
                </p>
                {diffSummary ? (
                    <p className={styles.muted}>
                        {`Blocks since ${diffSummary.label}: +${diffSummary.added} new · ~${diffSummary.modified} changed · −${diffSummary.removed} removed`}
                    </p>
                ) : null}
                {compareSha ? (
                    <div className={styles.row}>
                        <span className={classNames(styles.muted, styles.grow)}>
                            {`Comparing with commit ${compareSha.slice(0, 7)}`}
                        </span>
                        <button
                            className={styles.buttonSecondary}
                            disabled={disabled}
                            onClick={onCompareReset}
                        >
                            {'Back to latest commit'}
                        </button>
                    </div>
                ) : null}
            </section>

            <section className={styles.card}>
                <div className={styles.row}>
                    <h2 className={classNames(styles.cardTitle, styles.grow)}>{'History'}</h2>
                    <button
                        className={styles.buttonSecondary}
                        disabled={disabled || !headSha}
                        onClick={onLoadLatest}
                    >
                        {'Download latest'}
                    </button>
                </div>
                <ul className={styles.commits}>
                    {commits.map(c => (
                        <li
                            className={styles.commit}
                            key={c.sha}
                        >
                            <div className={styles.grow}>
                                <div className={styles.commitMessage}>{firstLine(c.commit.message)}</div>
                                <div className={styles.muted}>
                                    <code>{c.sha.slice(0, 7)}</code>
                                    {' · '}{c.commit.author.name}
                                    {' · '}{formatDate(c.commit.author.date)}
                                </div>
                            </div>
                            <div className={styles.commitActions}>
                                <button
                                    className={styles.buttonSecondary}
                                    disabled={disabled || compareSha === c.sha}
                                    title="Highlight in the editor what changed relative to this commit"
                                    onClick={() => onCompare(c.sha)}
                                >
                                    {'Compare'}
                                </button>
                                <button
                                    className={styles.buttonSecondary}
                                    disabled={disabled}
                                    onClick={() => onLoadVersion(c.sha, c.sha.slice(0, 7))}
                                >
                                    {'Load'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </React.Fragment>
    );
};
RepoPanel.propTypes = {
    user: PropTypes.object,
    repo: PropTypes.string,
    branch: PropTypes.string,
    branches: PropTypes.arrayOf(PropTypes.string),
    commits: PropTypes.arrayOf(PropTypes.object),
    headSha: PropTypes.string,
    dirty: PropTypes.bool,
    commitMessage: PropTypes.string,
    newBranch: PropTypes.string,
    busy: PropTypes.string,
    onField: PropTypes.func,
    onDisconnect: PropTypes.func,
    onChangeRepo: PropTypes.func,
    onRefresh: PropTypes.func,
    onChangeBranch: PropTypes.func,
    onCommit: PropTypes.func,
    onLoadVersion: PropTypes.func,
    onLoadLatest: PropTypes.func,
    onCreateBranch: PropTypes.func,
    compareSha: PropTypes.string,
    diffSummary: PropTypes.shape({
        added: PropTypes.number,
        modified: PropTypes.number,
        removed: PropTypes.number,
        label: PropTypes.string
    }),
    onCompare: PropTypes.func,
    onCompareReset: PropTypes.func
};

const GitTabComponent = props => {
    let screen;
    if (!props.user) {
        screen = <LoginScreen {...props} />;
    } else if (!props.repo) {
        screen = <RepoPicker {...props} />;
    } else {
        screen = <RepoPanel {...props} />;
    }

    return (
        <div className={styles.wrapper}>
            <div className={styles.scroll}>
                <Messages
                    busy={props.busy}
                    error={props.error}
                    info={props.info}
                />
                {screen}
            </div>
        </div>
    );
};

GitTabComponent.propTypes = {
    user: PropTypes.object,
    repo: PropTypes.string,
    busy: PropTypes.string,
    error: PropTypes.string,
    info: PropTypes.string
};

export default GitTabComponent;