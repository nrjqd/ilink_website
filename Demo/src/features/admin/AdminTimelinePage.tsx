/**
 * I-LINK CMS 後台殼層：登入、資料載入、側欄導覽、路由（/admin、/admin/posts、/admin/posts/:id、
 * /admin/media）、Toast 與確認對話框。各頁內容在 Admin*View 元件中。
 *
 * 路由沿用 App 的 history + popstate 機制，不引入 router；整個後台（含 admin.css）隨此 chunk lazy load。
 */

import "./admin.css";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ExternalLink, FileText, Gauge, Images, LogOut, Menu, RefreshCw, X } from "lucide-react";
import {
  ApiError,
  fetchAdminCmsHealth,
  fetchAdminDashboard,
  fetchAdminPosts,
  fetchCurrentUser,
  fetchTrashPosts,
  loginAdmin,
  type AdminCmsHealth,
  type AdminDashboard,
  type AdminUser,
  type PostResponse,
} from "./admin.api";
import { AdminButton, LoadingState, describeError, isAuthError, useConfirm, useToasts } from "./adminUi";
import { ADMIN_PATHS, parseAdminPath, type AdminContext } from "./adminContext";
import { AdminDashboardView } from "./AdminDashboardView";
import { AdminPostsView } from "./AdminPostsView";
import { AdminPostEditor } from "./AdminPostEditor";
import { AdminMediaView } from "./AdminMediaView";

interface AdminTimelinePageProps {
  currentPath?: string;
}

const tokenStorageKey = "ilink-admin-token";
const POSTS_LIMIT = 100;

type AuthStatus = "anonymous" | "checking" | "ready" | "error";

const navItems = [
  { key: "dashboard", label: "總覽", href: ADMIN_PATHS.dashboard, icon: Gauge },
  { key: "posts", label: "文章管理", href: ADMIN_PATHS.posts, icon: FileText },
  { key: "media", label: "媒體庫", href: ADMIN_PATHS.media, icon: Images },
] as const;

function readStoredToken() {
  try {
    return localStorage.getItem(tokenStorageKey) ?? "";
  } catch {
    return "";
  }
}

function storeToken(token: string) {
  try {
    if (token) localStorage.setItem(tokenStorageKey, token);
    else localStorage.removeItem(tokenStorageKey);
  } catch {
    // 無痕模式或封鎖儲存空間時仍可在本次分頁中使用。
  }
}

export function AdminTimelinePage({ currentPath = "/admin" }: AdminTimelinePageProps) {
  const view = useMemo(() => parseAdminPath(currentPath), [currentPath]);
  const [token, setToken] = useState(readStoredToken);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => (readStoredToken() ? "checking" : "anonymous"));
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [health, setHealth] = useState<AdminCmsHealth | null>(null);
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [trashPosts, setTrashPosts] = useState<PostResponse[]>([]);
  const [trashTotal, setTrashTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const editorDirtyRef = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { notify, toastElement } = useToasts();
  const { confirm, confirmElement } = useConfirm();

  const logout = useCallback((message?: string) => {
    storeToken("");
    setToken("");
    setUser(null);
    setDashboard(null);
    setHealth(null);
    setPosts([]);
    setTrashPosts([]);
    editorDirtyRef.current = false;
    setAuthMessage(message ?? null);
    setAuthStatus("anonymous");
  }, []);

  const reportError = useCallback(
    (error: unknown, fallback: string) => {
      if (isAuthError(error)) {
        logout("登入已逾時，請重新登入。");
        return;
      }
      notify("error", describeError(error, fallback));
    },
    [logout, notify],
  );

  const refreshPosts = useCallback(async () => {
    if (!token) return;
    const [active, trash] = await Promise.all([
      fetchAdminPosts(token, { limit: POSTS_LIMIT }),
      fetchTrashPosts(token, { limit: POSTS_LIMIT }),
    ]);
    setPosts(active.items);
    setPostsTotal(active.total);
    setTrashPosts(trash.items);
    setTrashTotal(trash.total);
  }, [token]);

  const refreshDashboard = useCallback(async () => {
    if (!token) return;
    setDashboard(await fetchAdminDashboard(token));
  }, [token]);

  const loadAll = useCallback(
    async (activeToken: string) => {
      const [nextUser, nextDashboard, active, trash] = await Promise.all([
        fetchCurrentUser(activeToken),
        fetchAdminDashboard(activeToken),
        fetchAdminPosts(activeToken, { limit: POSTS_LIMIT }),
        fetchTrashPosts(activeToken, { limit: POSTS_LIMIT }),
      ]);
      setUser(nextUser);
      setDashboard(nextDashboard);
      setPosts(active.items);
      setPostsTotal(active.total);
      setTrashPosts(trash.items);
      setTrashTotal(trash.total);
      // 系統檢查失敗不應擋住後台使用。
      fetchAdminCmsHealth(activeToken).then(setHealth).catch(() => setHealth(null));
    },
    [],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setAuthStatus((status) => (status === "ready" ? status : "checking"));
    loadAll(token)
      .then(() => {
        if (!cancelled) setAuthStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          logout(describeError(error, "登入已失效"));
        } else {
          setAuthMessage(describeError(error, "後台資料載入失敗"));
          setAuthStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey, loadAll, logout]);

  // 編輯中有未儲存變更時，重新整理 / 關閉分頁前提醒。
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!editorDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.querySelector<HTMLElement>(".adm-sidebar a, .adm-sidebar button")?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const setEditorDirty = useCallback((dirty: boolean) => {
    editorDirtyRef.current = dirty;
  }, []);

  const navigate = useCallback(
    (path: string, options: { replace?: boolean } = {}) => {
      const go = () => {
        editorDirtyRef.current = false;
        if (options.replace) window.history.replaceState({}, "", path);
        else window.history.pushState({}, "", path);
        // App 監聽 popstate 更新目前路徑。
        window.dispatchEvent(new PopStateEvent("popstate"));
      };
      if (!editorDirtyRef.current) {
        go();
        return;
      }
      void confirm({
        title: "離開前要放棄變更嗎？",
        message: "這篇文章有尚未儲存的變更，離開後變更會遺失。",
        confirmLabel: "放棄變更並離開",
        cancelLabel: "繼續編輯",
        tone: "danger",
      }).then((ok) => {
        if (ok) go();
      });
    },
    [confirm],
  );

  const context: AdminContext = {
    token,
    navigate,
    notify,
    confirm,
    reportError,
    dashboard,
    health,
    posts,
    trashPosts,
    postsTotal,
    postsComplete: posts.length >= postsTotal && trashPosts.length >= trashTotal,
    refreshPosts,
    refreshDashboard,
    upsertPost: (post) => {
      setPosts((current) => {
        const exists = current.some((item) => item.id === post.id);
        return exists ? current.map((item) => (item.id === post.id ? post : item)) : [post, ...current];
      });
      setTrashPosts((current) => current.filter((item) => item.id !== post.id));
      setPostsTotal((total) => (posts.some((item) => item.id === post.id) ? total : total + 1));
    },
    movePostToTrash: (post) => {
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setPostsTotal((total) => Math.max(0, total - 1));
      setTrashPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
      setTrashTotal((total) => total + 1);
    },
    removePost: (postId) => {
      setTrashPosts((current) => current.filter((item) => item.id !== postId));
      setTrashTotal((total) => Math.max(0, total - 1));
    },
    setEditorDirty,
  };

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refreshPosts(), refreshDashboard()]);
      notify("success", "資料已更新");
    } catch (error) {
      reportError(error, "重新整理失敗");
    } finally {
      setRefreshing(false);
    }
  }

  function onNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    // 阻止事件冒泡到 App 的全域連結攔截，改由 navigate 處理未儲存變更提醒。
    event.stopPropagation();
    navigate(href);
  }

  if (authStatus === "anonymous" || !token) {
    return (
      <AdminLogin
        message={authMessage}
        onLoggedIn={(nextToken) => {
          storeToken(nextToken);
          setAuthMessage(null);
          setAuthStatus("checking");
          setToken(nextToken);
        }}
      />
    );
  }

  if (authStatus === "error") {
    return (
      <main className="adm-center-screen">
        <div className="adm-card adm-login">
          <h1>後台暫時無法載入</h1>
          <p className="adm-form-error" role="alert">
            {authMessage}
          </p>
          <div className="adm-row">
            <AdminButton variant="primary" onClick={() => setReloadKey((key) => key + 1)}>
              重試
            </AdminButton>
            <AdminButton variant="secondary" onClick={() => logout()}>
              重新登入
            </AdminButton>
          </div>
        </div>
      </main>
    );
  }

  if (authStatus === "checking" || !user) {
    return (
      <main className="adm-center-screen">
        <LoadingState label="正在載入後台…" />
      </main>
    );
  }

  const activeNav = view.name === "postEditor" ? "posts" : view.name;

  return (
    <div className={`adm-shell ${drawerOpen ? "is-drawer-open" : ""}`}>
      <a className="adm-skip-link" href="#adm-main">
        跳到主要內容
      </a>

      <aside className="adm-sidebar" id="adm-sidebar" aria-label="後台導覽">
        <div className="adm-sidebar__brand">
          <span className="adm-sidebar__logo" aria-hidden="true">
            IL
          </span>
          <span className="adm-sidebar__brand-text">
            <strong>I-LINK</strong>
            <small>內容管理</small>
          </span>
          <button
            type="button"
            className="adm-icon-btn adm-sidebar__close"
            onClick={() => {
              setDrawerOpen(false);
              menuButtonRef.current?.focus();
            }}
            aria-label="關閉選單"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="adm-nav" aria-label="後台主要導覽">
          <ul>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <li key={item.key}>
                  <a
                    href={item.href}
                    className={isActive ? "is-active" : undefined}
                    aria-current={isActive ? "page" : undefined}
                    onClick={(event) => onNavClick(event, item.href)}
                    title={item.label}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="adm-nav__label">{item.label}</span>
                    {item.key === "posts" && dashboard ? (
                      <span className="adm-nav__count" aria-label={`${dashboard.posts.total} 篇`}>
                        {dashboard.posts.total}
                      </span>
                    ) : null}
                  </a>
                </li>
              );
            })}
            <li className="adm-nav__divider" aria-hidden="true" />
            <li>
              <a href="/" target="_blank" rel="noopener" title="查看網站（另開分頁）">
                <ExternalLink size={18} aria-hidden="true" />
                <span className="adm-nav__label">查看網站</span>
              </a>
            </li>
          </ul>
        </nav>

        <div className="adm-sidebar__footer">
          <div className="adm-sidebar__user" title={user.email}>
            <strong>{user.display_name || user.email}</strong>
            {user.display_name ? <small>{user.email}</small> : null}
          </div>
          <button type="button" className="adm-sidebar__action" onClick={() => void handleRefresh()} disabled={refreshing} title="重新整理資料">
            <RefreshCw size={16} aria-hidden="true" className={refreshing ? "adm-spin" : undefined} />
            <span className="adm-nav__label">重新整理</span>
          </button>
          <button type="button" className="adm-sidebar__action" onClick={() => logout()} title="登出">
            <LogOut size={16} aria-hidden="true" />
            <span className="adm-nav__label">登出</span>
          </button>
        </div>
      </aside>

      {drawerOpen ? <div className="adm-backdrop" aria-hidden="true" onClick={() => setDrawerOpen(false)} /> : null}

      <div className="adm-body">
        <header className="adm-topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="adm-icon-btn adm-topbar__menu"
            aria-label="開啟選單"
            aria-controls="adm-sidebar"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="adm-topbar__title">I-LINK CMS</span>
          <span className="adm-topbar__user">{user.display_name || user.email}</span>
        </header>

        <main className="adm-main" id="adm-main" tabIndex={-1}>
          {view.name === "dashboard" ? <AdminDashboardView ctx={context} /> : null}
          {view.name === "posts" ? <AdminPostsView ctx={context} /> : null}
          {view.name === "postEditor" ? <AdminPostEditor key={view.postId ?? "new"} ctx={context} postId={view.postId} /> : null}
          {view.name === "media" ? <AdminMediaView ctx={context} /> : null}
        </main>
      </div>

      {toastElement}
      {confirmElement}
    </div>
  );
}

function AdminLogin({ message, onLoggedIn }: { message: string | null; onLoggedIn: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      onLoggedIn(await loginAdmin(email.trim(), password));
    } catch (nextError) {
      setError(
        nextError instanceof ApiError && nextError.status === 401
          ? "Email 或密碼不正確。"
          : describeError(nextError, "登入失敗"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const shownError = error ?? message;

  return (
    <main className="adm-center-screen">
      <form className="adm-card adm-login" onSubmit={handleSubmit} aria-labelledby="adm-login-title">
        <div>
          <span className="adm-eyebrow">I-LINK CMS</span>
          <h1 id="adm-login-title">登入管理後台</h1>
        </div>
        <div className="adm-field">
          <label htmlFor="adm-login-email">Email</label>
          <input
            id="adm-login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </div>
        <div className="adm-field">
          <label htmlFor="adm-login-password">密碼</label>
          <input
            id="adm-login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {shownError ? (
          <p className="adm-form-error" role="alert">
            {shownError}
          </p>
        ) : null}
        <AdminButton variant="primary" type="submit" busy={submitting}>
          {submitting ? "登入中…" : "登入"}
        </AdminButton>
        <a className="adm-link-muted" href="/">
          ← 回到網站
        </a>
      </form>
    </main>
  );
}
