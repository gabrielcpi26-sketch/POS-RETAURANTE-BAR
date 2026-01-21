export async function getTenantConfig() {
  const res = await fetch("/api/tenant-config", {
    headers: {
      "X-Tenant": "default",
    },
  });
  if (!res.ok) throw new Error("Failed to load tenant config");
  return res.json();
}

export async function saveTenantConfig(config) {
  const res = await fetch("/api/tenant-config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant": "default",
    },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) throw new Error("Failed to save tenant config");
  return res.json();
}
