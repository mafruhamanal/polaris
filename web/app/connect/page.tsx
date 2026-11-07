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
    <main className="p-8 max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Connect Mac app</h1>
      <p className="text-sm text-gray-600">A device token has been generated. Copy it or use the deep link.</p>
      <div>
        <p className="text-xs text-gray-500 mb-1">Token</p>
        <code className="block bg-gray-100 rounded p-3 text-xs break-all">{token}</code>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Deep link (opens Mac app)</p>
        <a href={deepLink} className="inline-block rounded bg-black px-4 py-2 text-sm text-white">
          Open Polaris
        </a>
        <code className="mt-2 block bg-gray-100 rounded p-3 text-xs break-all">{deepLink}</code>
      </div>
      <p className="text-xs text-gray-400">
        Test: <code className="bg-gray-100 px-1 rounded">curl -H "Authorization: Bearer {token}" http://localhost:3000/api/settings</code>
      </p>
    </main>
  );
}
