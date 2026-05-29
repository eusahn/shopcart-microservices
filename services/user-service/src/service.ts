import type { ServiceImpl } from "@connectrpc/connect";
import { UserService } from "@shopcart/proto/user-connect";
import {
  UserProfile, Address, GetUserResponse, ListAddressesResponse,
} from "@shopcart/proto/user";
import { InvalidArgument, NotFound } from "@shopcart/errors";
import { pool } from "./db.js";

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  phone: string;
  created_at: Date;
}

interface AddressRow {
  id: string;
  user_id: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

const toProfile = (r: ProfileRow) => new UserProfile({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  phone: r.phone,
  createdAtUnix: BigInt(Math.floor(r.created_at.getTime() / 1000)),
});

const toAddress = (r: AddressRow) => new Address({
  id: r.id,
  userId: r.user_id,
  line1: r.line1,
  line2: r.line2,
  city: r.city,
  region: r.region,
  postalCode: r.postal_code,
  country: r.country,
  isDefault: r.is_default,
});

export const userImpl: ServiceImpl<typeof UserService> = {
  async getUser(req) {
    if (!req.id) throw new InvalidArgument("id is required").toConnect();
    const { rows } = await pool.query<ProfileRow>(`SELECT * FROM user_profiles WHERE id = $1`, [req.id]);
    const r = rows[0];
    if (!r) throw new NotFound("user").toConnect();
    return new GetUserResponse({ profile: toProfile(r) });
  },

  async upsertProfile(req) {
    if (!req.id || !req.email) throw new InvalidArgument("id and email required").toConnect();
    const { rows } = await pool.query<ProfileRow>(
      `INSERT INTO user_profiles (id, email, display_name, phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             display_name = EXCLUDED.display_name,
             phone = EXCLUDED.phone,
             updated_at = now()
       RETURNING *`,
      [req.id, req.email, req.displayName, req.phone],
    );
    return toProfile(rows[0]!);
  },

  async listAddresses(req) {
    const { rows } = await pool.query<AddressRow>(
      `SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [req.userId],
    );
    return new ListAddressesResponse({ addresses: rows.map(toAddress) });
  },

  async addAddress(req) {
    if (req.isDefault) {
      await pool.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [req.userId]);
    }
    const { rows } = await pool.query<AddressRow>(
      `INSERT INTO addresses (user_id, line1, line2, city, region, postal_code, country, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.userId, req.line1, req.line2, req.city, req.region, req.postalCode, req.country, req.isDefault],
    );
    return toAddress(rows[0]!);
  },
};
