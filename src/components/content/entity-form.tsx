import { saveEntity } from "@/app/staff/content/actions";
import { formValue, type Field, type Option } from "@/lib/content/fields";
import type { Entity } from "@/lib/content/entities";
import { ActionForm } from "../action-form";

/** Form for any content type, built from its field list. `options` holds choices for ref and country fields. */
export function EntityForm({ entity, row, options }: { entity: Entity; row?: Record<string, unknown> | null; options: Record<string, Option[]> }) {
  return (
    <ActionForm action={saveEntity} submit={row ? "Save changes" : `Create ${entity.singular}`} resetOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="entity" value={entity.key} />
      {row && <input type="hidden" name="id" value={String(row.id)} />}
      {entity.fields.map((f) => <FieldInput key={f.name} f={f} value={row ? row[f.name] : undefined} options={options[f.name] ?? f.options ?? []} />)}
    </ActionForm>
  );
}

function FieldInput({ f, value, options }: { f: Field; value: unknown; options: Option[] }) {
  const id = `f-${f.name}`;
  const v = value === undefined ? "" : f.type === "phone" && value ? `+${String(value)}` : formValue(f, value);
  const help = f.help ? <p id={`${id}-h`} className="mt-1 text-xs muted">{f.help}</p> : null;
  const aria = f.help ? { "aria-describedby": `${id}-h` } : {};
  const wrap = f.wide || f.type === "textarea" ? "sm:col-span-2" : "";
  const lbl = <label className="label" htmlFor={id}>{f.label}{f.required && <span className="text-red-700" aria-hidden="true"> *</span>}</label>;
  if (f.type === "checkbox") {
    return <div className={`flex items-start gap-2 self-end pb-2 ${wrap}`}><input id={id} name={f.name} type="checkbox" defaultChecked={value === undefined ? f.name === "active" : !!value} className="mt-1 size-4 accent-brand" {...aria} /><div><label htmlFor={id} className="text-sm font-semibold">{f.label}</label>{help}</div></div>;
  }
  if (f.type === "textarea") {
    return <div className={wrap}>{lbl}<textarea id={id} name={f.name} defaultValue={v} required={f.required} maxLength={f.max} rows={f.max && f.max > 1000 ? 8 : 3} className="input" {...aria} />{help}</div>;
  }
  if (f.type === "select" || f.type === "ref" || f.type === "country") {
    return (
      <div className={wrap}>{lbl}
        <select id={id} name={f.name} defaultValue={v} required={f.required} className="input" {...aria}>
          <option value="" disabled={f.required}>{f.required ? "Choose…" : f.optionalLabel ?? "None"}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>{help}
      </div>
    );
  }
  const type = f.type === "date" ? "date" : f.type === "url" ? "url" : f.type === "int" ? "number" : f.type === "phone" ? "tel" : "text";
  return <div className={wrap}>{lbl}<input id={id} name={f.name} type={type} defaultValue={v} required={f.required} maxLength={f.max} inputMode={f.type === "money" ? "decimal" : undefined} step={f.type === "int" ? 1 : undefined} className="input" {...aria} />{help}</div>;
}
