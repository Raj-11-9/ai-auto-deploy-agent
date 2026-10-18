import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../services/api";
import { useResource } from "../hooks/useResource";
import { EmptyState, ErrorState, Loading } from "../components/ui";
import type { Project } from "../types/api";
export default function Projects() {
  const resource = useResource(api.projects);
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("master");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [editing, setEditing] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function reset() {
    setUrl("");
    setBranch("master");
    setName("");
    setEditing(undefined);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editing)
        await api.updateProject(
          editing,
          {
            repository_url: url,
            branch,
            ...(name.trim() ? { name: name.trim() } : {}),
          },
          token,
        );
      else
        await api.createProject(
          {
            repository_url: url,
            branch,
            ...(name.trim() ? { name: name.trim() } : {}),
          },
          token,
        );
      setNotice(
        editing
          ? "Project updated."
          : "Repository connected. Configure its GitHub webhook using the setup guide.",
      );
      reset();
      resource.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save project");
    } finally {
      setBusy(false);
    }
  }
  async function change(project: Project, archive: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (archive) await api.deleteProject(project.id, token);
      else
        await api.updateProject(
          project.id,
          {
            status:
              project.status === "connected" ? "disconnected" : "connected",
          },
          token,
        );
      resource.refresh();
      setNotice(
        archive
          ? "Project archived; deployment history retained."
          : "Project status updated.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project update failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Projects</h1>
      <p className="page-description">
        Connect public GitHub repositories and choose the branch that requests
        deployments.
      </p>
      <section className="panel settings">
        <h2>{editing ? "Edit repository" : "Connect GitHub repository"}</h2>
        <form className="connect-form" onSubmit={save}>
          <label>
            Repository URL
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              maxLength={250}
            />
          </label>
          <div className="form-row">
            <label>
              Project name (optional)
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              Deployment branch
              <input
                required
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                maxLength={200}
              />
            </label>
          </div>
          <label>
            Management token
            <input
              type="password"
              autoComplete="off"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="MANAGEMENT_API_TOKEN from backend/.env"
            />
          </label>
          <p>
            The token stays in this page's memory. Public repositories only. A
            matching branch push queues a request; builds and deployments do not
            run yet.
          </p>
          <div className="form-actions">
            <button className="primary-button" disabled={busy}>
              {busy
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Connect repository"}
            </button>
            {editing && (
              <button type="button" onClick={reset}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Connected projects</h2>
          <span className="tag">Refreshes every 15s</span>
        </div>
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.refresh} />
        ) : !resource.data?.length ? (
          <EmptyState title="No projects connected yet">
            Use the form above to connect a public GitHub repository.
          </EmptyState>
        ) : (
          <div className="project-list">
            {resource.data.map((p) => (
              <article key={p.id}>
                <h3>{p.name}</h3>
                <p>{p.repository_url}</p>
                <span>
                  {p.branch} · {p.status} · GitHub ID{" "}
                  {p.github_repository_id ??
                    "unresolved: save repository URL to enable webhooks"}
                </span>
                <div className="form-actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditing(p.id);
                      setUrl(p.repository_url);
                      setBranch(p.branch);
                      setName(p.name);
                      setError("");
                      setNotice("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy || !token}
                    onClick={() => void change(p, false)}
                  >
                    {p.status === "connected" ? "Disconnect" : "Reconnect"}
                  </button>
                  <button
                    disabled={busy || !token}
                    onClick={() => void change(p, true)}
                  >
                    Archive project
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
