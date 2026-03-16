import { createHttpAgent } from "@/libs/http";
import { createCrudHooks } from "@/libs/query-agent";
import type { LoginBody, LoginResponse, MeResponse } from "./model";

const authAgent = createHttpAgent({ basePath: "/api/v1/auth", auth: false });
const meAgent = createHttpAgent({ basePath: "/api/v1/auth/me", auth: true });

export async function login(body: LoginBody): Promise<LoginResponse> {
  return authAgent.post<LoginResponse>("/login", body);
}

export async function me(): Promise<MeResponse> {
  return meAgent.get<MeResponse>("");
}

export const authHooks = createCrudHooks<MeResponse, MeResponse, never, never>({
  agent: meAgent,
  key: "satpam-auth-me",
});