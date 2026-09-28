import { prisma } from "../db.js";

const modelMap = {
  Party: prisma.party,
  Ticket: prisma.ticket,
  Payment: prisma.payment,
  PnrRecord: prisma.pnrRecord,
  Settings: prisma.settings,
  User: prisma.user,
  QrScan: prisma.qrScan
};

function stripProjection(doc, projection) {
  if (!doc || !projection) return doc;
  const fields = typeof projection === "string"
    ? projection.split(/\s+/).filter(Boolean)
    : Object.keys(projection).filter((k) => projection[k]);
  if (!fields.length) return doc;
  const out = {};
  for (const field of fields) if (field in doc) out[field] = doc[field];
  return out;
}

function normalizeWhere(where = {}) {
  if (!where || typeof where !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(where)) {
    if (key === "$or") {
      out.OR = value.map(normalizeWhere);
      continue;
    }
    if (key === "$and") {
      out.AND = value.map(normalizeWhere);
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const ops = {};
      if ("$gt" in value) ops.gt = value.$gt;
      if ("$gte" in value) ops.gte = value.$gte;
      if ("$lt" in value) ops.lt = value.$lt;
      if ("$lte" in value) ops.lte = value.$lte;
      if ("$ne" in value) ops.not = value.$ne;
      if ("$in" in value) ops.in = value.$in;
      if (Object.keys(ops).length) {
        out[key] = ops;
        continue;
      }
    }
    out[key] = value;
  }
  return out;
}

function normalizeData(data = {}) {
  const out = { ...data };
  for (const key of ["balance", "amount", "fare"]) {
    if (key in out && out[key] !== null && out[key] !== undefined) out[key] = Number(out[key]);
  }
  return out;
}

class Query {
  constructor(executor) {
    this.executor = executor;
    this.projection = null;
    this.orderBy = null;
    this.take = null;
  }

  select(projection) {
    this.projection = projection;
    return this;
  }

  lean() {
    return this;
  }

  sort(sortSpec = {}) {
    const entries = Object.entries(sortSpec);
    if (entries.length) {
      this.orderBy = entries.map(([field, direction]) => ({
        [field]: direction === -1 ? "desc" : "asc"
      }));
    }
    return this;
  }

  limit(value) {
    this.take = Number(value);
    return this;
  }

  async exec() {
    let result = await this.executor({
      projection: this.projection,
      orderBy: this.orderBy,
      take: this.take
    });
    if (Array.isArray(result)) {
      return result.map((item) => stripProjection(item, this.projection));
    }
    return stripProjection(result, this.projection);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

function makeModel(name) {
  const model = modelMap[name];

  return {
    findOne(where = {}) {
      return new Query(async ({ projection }) => {
        const row = await model.findFirst({
          where: normalizeWhere(where)
        });
        return stripProjection(row, projection);
      });
    },

    find(where = {}, projection = null) {
      return new Query(async ({ projection: chainProjection, orderBy, take }) => {
        const rows = await model.findMany({
          where: normalizeWhere(where),
          orderBy: orderBy || undefined,
          take: take || undefined
        });
        return rows.map((row) => stripProjection(row, chainProjection || projection));
      });
    },

    countDocuments(where = {}) {
      return model.count({ where: normalizeWhere(where) });
    },

    async create(data) {
      const row = await model.create({ data: normalizeData(data) });
      return {
        ...row,
        toObject() {
          return row;
        }
      };
    },

    findOneAndUpdate(where = {}, update = {}, options = {}) {
      return new Query(async ({ projection }) => {
        const normalizedWhere = normalizeWhere(where);
        const existing = await model.findFirst({ where: normalizedWhere });

        const set = normalizeData(update.$set || {});
        const inc = normalizeData(update.$inc || {});
        const setOnInsert = normalizeData(update.$setOnInsert || {});

        let row;
        if (existing) {
          const data = { ...set };
          for (const [key, value] of Object.entries(inc)) {
            data[key] = { increment: value };
          }
          row = await model.update({
            where: { id: existing.id },
            data
          });
        } else if (options.upsert) {
          row = await model.create({
            data: { ...setOnInsert, ...set, ...normalizeData(where) }
          });
        } else {
          return null;
        }

        return stripProjection(row, projection);
      });
    },

    async deleteOne(where = {}) {
      const existing = await model.findFirst({ where: normalizeWhere(where) });
      if (!existing) return { deletedCount: 0 };
      await model.delete({ where: { id: existing.id } });
      return { deletedCount: 1 };
    }
  };
}

export const Party = makeModel("Party");
export const Ticket = makeModel("Ticket");
export const Payment = makeModel("Payment");
export const PnrRecord = makeModel("PnrRecord");
export const Settings = makeModel("Settings");
export const User = makeModel("User");
export const QrScan = makeModel("QrScan");
