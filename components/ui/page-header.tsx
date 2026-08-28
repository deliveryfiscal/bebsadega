export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><h1 className="page-title">{title}</h1><p className="mt-1 text-sm text-slate-400">{description}</p></div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
