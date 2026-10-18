import {
  ArrowUpRight,
  Activity,
  Box,
  CheckCheck,
  CircleX,
  Server,
  Database,
  Layers,
} from "lucide-react";
import { api } from "../services/api";
import { useResource } from "../hooks/useResource";
import { EmptyState, ErrorState, Loading } from "../components/ui";
export function SystemHealth() {
  const health = useResource(api.health);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>System health</h2>
        <span className="muted">Live · refreshes every 15s</span>
      </div>
      {health.error && (
        <ErrorState message={health.error} retry={health.refresh} />
      )}
      <div className="health-grid">
        {(
          [
            {
              key: "backend",
              label: "Backend API",
              detail: "NestJS · Port 4000",
              Icon: Server,
            },
            {
              key: "database",
              label: "PostgreSQL",
              detail: "Database · Version 16",
              Icon: Database,
            },
            {
              key: "redis",
              label: "Redis",
              detail: "Cache · Version 7",
              Icon: Layers,
            },
          ] as const
        ).map(({ key, label, detail, Icon }) => {
          const status = health.data?.services[key].status ?? "unknown";
          return (
            <div className="service" key={key}>
              <Icon size={20} />
              <div>
                <strong>{label}</strong>
                <small>{detail}</small>
              </div>
              <span className={`status ${status}`}>
                <i />
                {health.loading
                  ? "Checking"
                  : status === "up"
                    ? "Operational"
                    : status === "down"
                      ? "Unavailable"
                      : "Unknown"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
export default function Overview() {
  const summary = useResource(api.summary);
  const stats = [
    { title: "Total projects", value: summary.data?.totalProjects, Icon: Box },
    {
      title: "Total deployments",
      value: summary.data?.totalDeployments,
      Icon: Activity,
    },
    {
      title: "Successful deployments",
      value: summary.data?.successfulDeployments,
      Icon: CheckCheck,
    },
    {
      title: "Failed deployments",
      value: summary.data?.failedDeployments,
      Icon: CircleX,
    },
  ];
  return (
    <>
      <div className="intro">
        <div>
          <span className="eyebrow">YOUR WORKSPACE AT A GLANCE</span>
          <h1>Overview</h1>
          <p>A clear view of your projects, deployments, and infrastructure.</p>
        </div>
        <span className="tag">Phase 02 / GitHub integration</span>
      </div>
      {summary.error && (
        <ErrorState message={summary.error} retry={summary.refresh} />
      )}
      {summary.loading ? (
        <Loading />
      ) : (
        <div className="stats">
          {stats.map(({ title, value, Icon }) => (
            <div className="stat" key={title}>
              <div>
                <span>{title}</span>
                <Icon size={18} />
              </div>
              <strong>{value ?? "—"}</strong>
              <small>
                {value === undefined
                  ? "Waiting for database"
                  : "Across your workspace"}
              </small>
            </div>
          ))}
        </div>
      )}
      <SystemHealth />
      <section className="panel">
        <div className="panel-head">
          <h2>Recent deployments</h2>
          <a href="#deployments">
            View deployments <ArrowUpRight size={15} />
          </a>
        </div>
        <RecentDeployments />
      </section>
      <div className="foundation">
        <div className="foundation-symbol">⌘</div>
        <div>
          <h3>Connect a repository. Queue your next release.</h3>
          <p>
            GitHub pushes can now queue deployment requests. Build and
            deployment execution come in a later phase.
          </p>
        </div>
        <span className="tag">Built to grow</span>
      </div>
    </>
  );
}
export function RecentDeployments() {
  const resource = useResource(api.deployments);
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <ErrorState message={resource.error} retry={resource.refresh} />;
  if (!resource.data?.length)
    return (
      <EmptyState title="No deployments yet">
        Push to a connected repository's configured branch to queue a deployment
        request.
      </EmptyState>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Deployment</th>
            <th>Commit</th>
            <th>Trigger</th>
            <th>Branch</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {resource.data.map((d) => (
            <tr key={d.id}>
              <td>{d.id.slice(0, 8)}</td>
              <td title={d.commit_sha ?? undefined}>
                {d.commit_sha?.slice(0, 12) ?? "-"}
              </td>
              <td>
                {d.trigger_type === "github_push" ? "GitHub push" : "Manual"}
              </td>
              <td>{d.branch}</td>
              <td>
                <span className={`deployment-status ${d.status}`}>
                  {d.status}
                </span>
              </td>
              <td>{new Date(d.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
