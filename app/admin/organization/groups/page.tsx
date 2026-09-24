import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { api, q } from "@/lib/convex";
import { MENUS } from "@/lib/permissions";
import { savePermissionGroup } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const actor = await getSession();
  if (!actor || actor.role !== "admin") redirect("/admin/learning");
  const data = await q((convex, secret) => convex.query(api.reads.groupsView, { secret }));
  const groups = data.groups;
  const links = data.links;
  const byGroup = new Map<number, Set<string>>();
  for (const link of links) {
    const set = byGroup.get(link.group_id) ?? new Set<string>();
    set.add(link.menu_key);
    byGroup.set(link.group_id, set);
  }
  return (
    <main>
      <h1 className="serif">Nhóm quyền</h1>
      <p className="muted">Mỗi nhóm chọn menu mà User thuộc nhóm đó được nhìn thấy. Admin thấy mọi menu. Mod thấy mọi menu trừ Người dùng, Phòng ban và Nhóm quyền.</p>
      <form action={savePermissionGroup} className="card">
        <h2>Nhóm mới</h2>
        <div className="field"><label htmlFor="name">Tên nhóm</label><input id="name" name="name" required /></div>
        <div className="field"><label htmlFor="description">Mô tả</label><input id="description" name="description" /></div>
        <MenuChecks selected={new Set()} />
        <button className="btn dark" type="submit">Tạo nhóm</button>
      </form>
      {groups.map((group) => (
        <form key={group.id} action={savePermissionGroup} className="card" style={{ marginTop: 12 }}>
          <input type="hidden" name="id" value={group.id} />
          <div className="field"><label htmlFor={`name-${group.id}`}>Tên nhóm</label><input id={`name-${group.id}`} name="name" defaultValue={group.name} required /></div>
          <div className="field"><label htmlFor={`desc-${group.id}`}>Mô tả</label><input id={`desc-${group.id}`} name="description" defaultValue={group.description} /></div>
          <MenuChecks selected={byGroup.get(group.id) ?? new Set()} />
          <button className="btn" type="submit">Lưu menu của nhóm</button>
        </form>
      ))}
    </main>
  );
}

function MenuChecks({ selected }: { selected: Set<string> }) {
  return (
    <div className="grid-3">
      {MENUS.map((menu) => (
        <label key={menu.key} className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="menus" value={menu.key} defaultChecked={selected.has(menu.key)} />
          <span>{menu.label}<small className="muted" style={{ display: "block" }}>{menu.area === "admin" ? "Quản trị" : "Học tập"}{menu.adminOnly ? " · chỉ Admin" : ""}</small></span>
        </label>
      ))}
    </div>
  );
}
