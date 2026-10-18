import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() name!: string;
  @Column() repository_url!: string;
  @Column({ type: "bigint", nullable: true, unique: true })
  github_repository_id!: string | null;
  @Column({ type: "varchar", nullable: true }) repository_owner!: string | null;
  @Column({ type: "varchar", nullable: true }) repository_name!: string | null;
  @Column({ default: "master" }) branch!: string;
  @Column({ type: "varchar", nullable: true }) framework!: string | null;
  @Column({ default: "connected" }) status!: string;
  @CreateDateColumn({ type: "timestamptz" }) created_at!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updated_at!: Date;
  @OneToMany(() => Deployment, (deployment) => deployment.project)
  deployments!: Deployment[];
}
@Entity("deployments")
export class Deployment {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Index() @Column("uuid") project_id!: string;
  @ManyToOne(() => Project, (project) => project.deployments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id" })
  project!: Project;
  @Column({ type: "varchar", nullable: true }) commit_sha!: string | null;
  @Column({ default: "master" }) branch!: string;
  @Index() @Column({ default: "pending" }) status!: string;
  @Column({ default: "manual" }) trigger_type!: string;
  @Column({ type: "varchar", nullable: true, unique: true }) queue_job_id!:
    | string
    | null;
  @Column({ type: "uuid", nullable: true }) webhook_delivery_id!: string | null;
  @Column({ type: "timestamptz", nullable: true }) started_at!: Date | null;
  @Column({ type: "timestamptz", nullable: true }) finished_at!: Date | null;
  @CreateDateColumn({ type: "timestamptz" }) created_at!: Date;
  @OneToMany(() => DeploymentLog, (log) => log.deployment)
  logs!: DeploymentLog[];
}
@Entity("deployment_logs")
export class DeploymentLog {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Index() @Column("uuid") deployment_id!: string;
  @ManyToOne(() => Deployment, (deployment) => deployment.logs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "deployment_id" })
  deployment!: Deployment;
  @Column({ default: "info" }) level!: string;
  @Column("text") message!: string;
  @CreateDateColumn({ type: "timestamptz" }) created_at!: Date;
}
