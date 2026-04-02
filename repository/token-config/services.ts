import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { TokenConfig, TokenConfigUpsert } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/token-config", auth: true });

export async function getTokenConfig(): Promise<TokenConfig> {
  return agent.get<TokenConfig>("");
}

export async function upsertTokenConfig(body: TokenConfigUpsert): Promise<TokenConfig> {
  return agent.post<TokenConfig>("", body);
}

export const tokenConfigHooks = createCrudHooksV2<
  TokenConfig,
  TokenConfig,
  TokenConfigUpsert,
  never,
  string,
  never
>({
  agent,
  key: "satpam-token-config",
});
