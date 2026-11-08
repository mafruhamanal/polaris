import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return true;
      await db`
        INSERT INTO users (email, name)
        VALUES (${user.email}, ${user.name ?? null})
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      `;
      return true;
    },
  },
});
