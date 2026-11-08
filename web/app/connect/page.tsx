import { redirect } from "next/navigation";
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";

export default async function ConnectPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const rows = await db`
    INSERT INTO mac_device_tokens (user_id, token)
    VALUES (${userId}, gen_random_uuid()::text)
    RETURNING token
  `;

  const token: string = rows[0].token;
  const deepLink = `polaris://connected?token=${token}`;

  return (
    <main className="p-10 max-w-2xl space-y-8">
      <h1 className="text-4xl font-bold text-star-white">Connect Mac app</h1>
      <p className="text-2xl text-star-white">A device token has been generated. Copy it or use the deep link.</p>
      <div className="space-y-2">
        <p className="text-xl font-medium text-star-white uppercase tracking-wide">Token</p>
        <code className="block bg-space-mid border border-space-light rounded-xl p-5 text-xl text-nebula-teal break-all">{token}</code>
      </div>
      <div className="space-y-3">
        <p className="text-xl font-medium text-star-white uppercase tracking-wide">Deep link (opens Mac app)</p>
        <a href={deepLink} className="inline-block rounded-xl bg-nebula-teal px-8 py-4 text-2xl font-semibold text-space-deep hover:opacity-90 transition-opacity">
          Open Polaris
        </a>
        <code className="block bg-space-mid border border-space-light rounded-xl p-5 text-xl text-nebula-teal break-all">{deepLink}</code>
      </div>
      <div className="bg-space-mid border border-space-light rounded-xl p-5 space-y-2">
        <p className="text-xl font-medium text-star-white">Test with curl:</p>
        <code className="block text-lg text-nebula-teal break-all">curl -H "Authorization: Bearer {token}" http://localhost:3000/api/settings</code>
      </div>
    </main>
  );
}
