import { OpenFeature, type Client } from "@openfeature/server-sdk";
import { FlagdProvider } from "@openfeature/flagd-provider";

let initialized = false;

export async function initFeatureFlags(opts: { host?: string; port?: number } = {}): Promise<Client> {
  if (!initialized) {
    await OpenFeature.setProviderAndWait(
      new FlagdProvider({
        host: opts.host ?? process.env.FLAGD_HOST ?? "flagd.platform.svc.cluster.local",
        port: opts.port ?? Number(process.env.FLAGD_PORT ?? 8013),
      }),
    );
    initialized = true;
  }
  return OpenFeature.getClient();
}

export { OpenFeature };
export type { Client };
