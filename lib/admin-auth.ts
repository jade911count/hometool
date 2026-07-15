// 管理 API 的密鑰驗證：n8n 排程呼叫時帶 Authorization: Bearer <ADMIN_TOKEN>

export function isAuthorized(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false; // 未設定密鑰時一律拒絕，避免裸奔
  const header = request.headers.get("authorization");
  return header === `Bearer ${token}`;
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
