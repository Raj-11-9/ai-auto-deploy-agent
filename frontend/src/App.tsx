import { useEffect, useState } from "react";
import {
  Activity,
  LayoutDashboard,
  FolderGit2,
  Rocket,
  ScrollText,
  Settings,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import Overview, { RecentDeployments, SystemHealth } from "./pages/Overview";
import Projects from "./pages/Projects";
import { EmptyState } from "./components/ui";
import { API_BASE_URL } from "./services/api";
const navigation = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "projects", label: "Projects", Icon: FolderGit2 },
  { id: "deployments", label: "Deployments", Icon: Rocket },
  { id: "logs", label: "Logs", Icon: ScrollText },
  { id: "settings", label: "Settings", Icon: Settings },
];
export default function App() {
  const [page, setPage] = useState(location.hash.slice(1) || "dashboard");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const change = () => {
      setPage(location.hash.slice(1) || "dashboard");
      setMenu(false);
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  return (
    <div className="app-shell">
      <aside className={menu ? "open" : ""}>
        <a className="brand" href="#dashboard">
          <span className="brand-mark">
            <Activity size={23} />
          </span>
          deploy<span className="brand-light">agent</span>
          <span className="beta">BETA</span>
        </a>
        <div className="workspace">
          <span className="avatar">W</span>
          <div>
            <strong>My workspace</strong>
            <small>Personal workspace</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {navigation.map(({ id, label, Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {page === id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="phase-card">
            <span className="eyebrow">GITHUB INTEGRATION</span>
            <p>
              One solid foundation.
              <br />
              Endless possibilities.
            </p>
            <span className="muted">Phase 2 - GitHub integration</span>
          </div>
          <div className="profile">
            <span className="avatar">D</span>
            <div>
              <strong>Developer</strong>
              <small>Local environment</small>
            </div>
            <span className="local-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header>
          <div className="breadcrumb">
            <button
              className="menu-toggle"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {navigation.find((n) => n.id === page)?.label || "Dashboard"}
            </strong>
          </div>
          <span className="environment">
            <i />
            Development
          </span>
        </header>
        <main>
          {page === "projects" ? (
            <Projects />
          ) : page === "deployments" ? (
            <>
              <h1>Deployments</h1>
              <p className="page-description">
                Track every release from commit to production.
              </p>
              <section className="panel">
                <RecentDeployments />
              </section>
            </>
          ) : page === "logs" ? (
            <>
              <h1>Deployment logs</h1>
              <p className="page-description">
                Build output and runtime activity, all in one place.
              </p>
              <section className="panel">
                <EmptyState title="No deployment logs yet" badge="Available in a future phase">
                  Log streaming becomes available with deployment execution in a
                  future phase.
                </EmptyState>
              </section>
            </>
          ) : page === "settings" ? (
            <>
              <h1>Settings</h1>
              <p className="page-description">
            <span>Local workspace / Phase 2</span>
              </p>
              <section className="panel settings">
                <h2>Environment configuration</h2>
                <p>
                  Manage these values in your local environment files, then
                  restart the applications.
                </p>
                <dl>
                  <dt>API endpoint</dt>
                  <dd>{API_BASE_URL}</dd>
                  <dt>Default repository branch</dt>
                  <dd>master</dd>
                  <dt>Execution mode</dt>
                  <dd>Queue only / deployment execution unavailable</dd>
                </dl>
                <a
                  href={`${API_BASE_URL}/health`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open health endpoint <ExternalLink size={14} />
                </a>
              </section>
              <SystemHealth />
            </>
          ) : (
            <Overview />
          )}
          <footer>
            <span>AI Auto Deploy Agent</span>
            <span>Local workspace / Phase 2</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
