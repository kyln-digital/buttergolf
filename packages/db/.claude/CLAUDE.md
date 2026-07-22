# ButterGolf Database - Claude Code Instructions

## Overview

This package provides the Prisma database client and schema for ButterGolf. It uses PostgreSQL as the database and exports a singleton Prisma client for use across the monorepo.

## Technology Stack

- **ORM**: Prisma 6.x
- **Database**: PostgreSQL
- **Provider**: Neon (serverless PostgreSQL)
- **Client**: Generated to `packages/db/generated/client` (custom output for pnpm compatibility)

## 🚨 CRITICAL: Import Rules (pnpm Monorepo)

**NEVER import directly from `@prisma/client`** - This causes "Cannot find module '.prisma/client/default'" build errors.

```typescript
// ❌ WRONG - NEVER DO THIS - Causes build failures
import { PrismaClient } from "@prisma/client";
import { ProductCondition } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// ✅ CORRECT - ALWAYS import from @buttergolf/db
import { prisma } from "@buttergolf/db";
import { ProductCondition } from "@buttergolf/db";
import type { Prisma } from "@buttergolf/db";
```

**Why This Matters:**

- pnpm uses symlinks and strict module resolution
- `@prisma/client` looks for `.prisma/client/default` which doesn't exist at expected paths
- Our custom Prisma output (`packages/db/generated/client`) fixes this
- Direct `@prisma/client` imports bypass this fix and cause build failures

**Available exports from @buttergolf/db:**

- `prisma` - The singleton PrismaClient instance
- `Prisma` - The Prisma namespace for types
- Enums: `ProductCondition`, `ClubKind`, `OrderStatus`, `OfferStatus`, `ShipmentStatus`

## Directory Structure

```
packages/db/
├── prisma/
│   ├── schema.prisma    # Database schema (output = "../generated/client")
│   ├── migrations/      # Migration files
│   └── seed.ts          # Seed script (imports from ../generated/client)
├── generated/
│   └── client/          # Generated Prisma Client (gitignored)
├── src/
│   └── index.ts         # Prisma client export (imports from ../generated/client)
└── package.json
```

## Prisma Schema

### Location

`prisma/schema.prisma` is the single source of truth for the database schema.

### Basic Structure

```prisma
generator client {
  provider = "prisma-client-js"
  // Custom output for pnpm monorepo compatibility
  output   = "../generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Models go here
```

### Common Model Patterns

#### Timestamps Pattern

```prisma
model Course {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### Relations Pattern

```prisma
model Course {
  id        String   @id @default(cuid())
  name      String
  holes     Hole[]
  bookings  Booking[]
}

model Hole {
  id        String  @id @default(cuid())
  number    Int
  par       Int
  courseId  String
  course    Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)
}
```

#### Enums Pattern

```prisma
enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
}

model Booking {
  id        String        @id @default(cuid())
  status    BookingStatus @default(PENDING)
}
```

#### Unique Constraints

```prisma
model User {
  id        String  @id @default(cuid())
  email     String  @unique
  clerkId   String  @unique

  @@index([clerkId])
  @@index([email])
}
```

#### Composite Indexes

```prisma
model Booking {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  date      DateTime

  @@index([userId, date])
  @@index([courseId, date])
}
```

## Prisma Client Usage

### Import Pattern

```typescript
// The singleton client is exported as `prisma` (there is no `db` export).
import { prisma } from "@buttergolf/db";
```

> Note: the CRUD snippets below use illustrative model names (course/hole/booking)
> to demonstrate the Prisma API. The actual schema is a golf-equipment
> **marketplace** — real models include `Product`, `Order`, `Offer`,
> `CounterOffer`, `Conversation`, `Message`, `Address`, `SellerRating`,
> `ProductPromotion`, and `User`. See `prisma/schema.prisma` for the source of truth.

### CRUD Operations

#### Create

```typescript
// Create single record
const course = await db.course.create({
  data: {
    name: "Pebble Beach",
    location: "California",
    description: "Famous golf course",
  },
});

// Create with relations
const courseWithHoles = await db.course.create({
  data: {
    name: "Augusta National",
    location: "Georgia",
    holes: {
      create: [
        { number: 1, par: 4, yardage: 445 },
        { number: 2, par: 5, yardage: 575 },
      ],
    },
  },
  include: {
    holes: true,
  },
});

// Create many
const courses = await db.course.createMany({
  data: [
    { name: "Course 1", location: "CA" },
    { name: "Course 2", location: "TX" },
  ],
});
```

#### Read

```typescript
// Find unique
const course = await db.course.findUnique({
  where: { id: courseId },
  include: { holes: true },
});

// Find first
const course = await db.course.findFirst({
  where: { active: true },
});

// Find many
const courses = await db.course.findMany({
  where: {
    active: true,
    location: "California",
  },
  include: {
    holes: true,
    bookings: {
      where: { status: "CONFIRMED" },
    },
  },
  orderBy: {
    name: "asc",
  },
  take: 10,
  skip: 0,
});

// Count
const count = await db.course.count({
  where: { active: true },
});
```

#### Update

```typescript
// Update single record
const course = await db.course.update({
  where: { id: courseId },
  data: {
    name: "New Name",
    updatedAt: new Date(),
  },
});

// Update many
const result = await db.course.updateMany({
  where: { location: "California" },
  data: { active: true },
});

// Upsert
const course = await db.course.upsert({
  where: { id: courseId },
  update: { name: "Updated Name" },
  create: {
    id: courseId,
    name: "New Course",
    location: "California",
  },
});
```

#### Delete

```typescript
// Delete single record
const course = await db.course.delete({
  where: { id: courseId },
});

// Delete many
const result = await db.course.deleteMany({
  where: { active: false },
});
```

### Advanced Queries

#### Filtering

```typescript
// Multiple conditions (AND)
const courses = await db.course.findMany({
  where: {
    active: true,
    location: "California",
    holes: {
      some: {
        par: 5,
      },
    },
  },
});

// OR conditions
const courses = await db.course.findMany({
  where: {
    OR: [{ location: "California" }, { location: "Texas" }],
  },
});

// NOT conditions
const courses = await db.course.findMany({
  where: {
    NOT: {
      location: "California",
    },
  },
});

// Complex nested conditions
const bookings = await db.booking.findMany({
  where: {
    AND: [
      {
        OR: [{ status: "CONFIRMED" }, { status: "PENDING" }],
      },
      {
        date: {
          gte: new Date("2024-01-01"),
        },
      },
    ],
  },
});
```

#### Sorting

```typescript
// Single field
const courses = await db.course.findMany({
  orderBy: {
    name: "asc",
  },
});

// Multiple fields
const courses = await db.course.findMany({
  orderBy: [{ location: "asc" }, { name: "asc" }],
});

// Related field
const bookings = await db.booking.findMany({
  orderBy: {
    course: {
      name: "asc",
    },
  },
});
```

#### Pagination

```typescript
// Offset-based pagination
const courses = await db.course.findMany({
  skip: 20,
  take: 10,
  orderBy: { name: "asc" },
});

// Cursor-based pagination
const courses = await db.course.findMany({
  take: 10,
  cursor: {
    id: lastCourseId,
  },
  skip: 1, // Skip the cursor
  orderBy: { id: "asc" },
});
```

#### Aggregations

```typescript
// Count
const count = await db.booking.count({
  where: { status: "CONFIRMED" },
});

// Aggregate
const result = await db.booking.aggregate({
  _avg: {
    price: true,
  },
  _sum: {
    price: true,
  },
  _min: {
    date: true,
  },
  _max: {
    date: true,
  },
  where: {
    status: "CONFIRMED",
  },
});

// Group by
const results = await db.booking.groupBy({
  by: ["courseId"],
  _count: {
    id: true,
  },
  _avg: {
    price: true,
  },
});
```

### Transactions

#### Sequential Operations

```typescript
const [booking, notification] = await db.$transaction([
  db.booking.create({
    data: {
      userId,
      courseId,
      date: new Date(),
    },
  }),
  db.notification.create({
    data: {
      userId,
      message: "Booking confirmed",
    },
  }),
]);
```

#### Interactive Transactions

```typescript
const result = await db.$transaction(async (tx) => {
  // Check availability
  const existing = await tx.booking.count({
    where: {
      courseId,
      date,
      status: "CONFIRMED",
    },
  });

  if (existing >= 10) {
    throw new Error("Fully booked");
  }

  // Create booking
  const booking = await tx.booking.create({
    data: {
      userId,
      courseId,
      date,
    },
  });

  // Update course stats
  await tx.course.update({
    where: { id: courseId },
    data: {
      bookingCount: { increment: 1 },
    },
  });

  return booking;
});
```

### Relations

#### Include

```typescript
// Include single relation
const course = await db.course.findUnique({
  where: { id: courseId },
  include: {
    holes: true,
  },
});

// Include nested relations
const booking = await db.booking.findUnique({
  where: { id: bookingId },
  include: {
    user: true,
    course: {
      include: {
        holes: true,
      },
    },
  },
});

// Include with filtering
const course = await db.course.findUnique({
  where: { id: courseId },
  include: {
    bookings: {
      where: { status: "CONFIRMED" },
      orderBy: { date: "desc" },
      take: 10,
    },
  },
});
```

#### Select

```typescript
// Select specific fields
const course = await db.course.findUnique({
  where: { id: courseId },
  select: {
    id: true,
    name: true,
    location: true,
    holes: {
      select: {
        number: true,
        par: true,
      },
    },
  },
});
```

## Database Commands

### Generate Client

After modifying `schema.prisma`, always regenerate the client:

```bash
pnpm db:generate
# or at root
pnpm turbo run db:generate
```

This generates TypeScript types and the Prisma client.

### Create Migration

```bash
# Create and apply migration in development
pnpm db:migrate:dev --name add_booking_status

# This will:
# 1. Create migration SQL file
# 2. Apply migration to database
# 3. Regenerate Prisma client
```

### Apply Migrations (Production)

```bash
# Apply pending migrations in production
pnpm db:migrate:deploy

# This only applies migrations, doesn't create new ones
```

### Push Schema (Development Only)

```bash
# Push schema changes without creating migration
pnpm db:push

# Useful for rapid prototyping
# NOT recommended for production
```

### Database Studio

```bash
# Open Prisma Studio GUI
pnpm db:studio

# Access at http://localhost:5555
```

### Seed Database

```bash
# Run seed script
pnpm db:seed
```

### Reset Database

```bash
# Drop database, recreate, apply migrations, run seed
pnpm db:reset

# WARNING: Deletes all data!
```

## Seed Script Pattern

```typescript
// prisma/seed.ts
// IMPORTANT: Import from generated client, NOT from @prisma/client
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.booking.deleteMany();
  await prisma.hole.deleteMany();
  await prisma.course.deleteMany();

  // Create courses
  const course1 = await prisma.course.create({
    data: {
      name: "Pebble Beach",
      location: "California",
      description: "Famous golf course",
      holes: {
        create: Array.from({ length: 18 }, (_, i) => ({
          number: i + 1,
          par: [4, 5, 3, 4, 4, 5, 3, 4, 4][i % 9],
          yardage: 400 + Math.floor(Math.random() * 200),
        })),
      },
    },
  });

  console.log("Seeded course:", course1.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## Environment Variables

```bash
# Required for Prisma
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# For connection pooling (optional)
POSTGRES_PRISMA_URL="postgresql://user:password@host:5432/dbname?pgbouncer=true"

# For direct connection (migrations)
POSTGRES_URL_NON_POOLING="postgresql://user:password@host:5432/dbname"
```

## Type Safety

### Generated Types

```typescript
import { Course, Hole, Booking, Prisma } from "@buttergolf/db";

// Use generated types
const course: Course = {
  id: "123",
  name: "Pebble Beach",
  location: "California",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Use input types
const createCourseData: Prisma.CourseCreateInput = {
  name: "Augusta National",
  location: "Georgia",
  holes: {
    create: [{ number: 1, par: 4, yardage: 445 }],
  },
};

// Use where types
const whereClause: Prisma.CourseWhereInput = {
  location: "California",
  active: true,
};
```

### Type Inference

```typescript
// Prisma infers return types
const course = await db.course.findUnique({
  where: { id: courseId },
  include: { holes: true },
});
// Type: Course & { holes: Hole[] }

const courses = await db.course.findMany({
  select: { id: true, name: true },
});
// Type: { id: string, name: string }[]
```

## Best Practices

### ✅ DO

- Always run `db:generate` after schema changes
- Use transactions for related operations
- Index frequently queried fields
- Use `cuid()` for IDs (better than UUID for sorting)
- Include `createdAt` and `updatedAt` timestamps
- Use cascading deletes appropriately
- Handle errors gracefully
- Use prepared statements (Prisma does this automatically)
- Test migrations before deploying

### ❌ DON'T

- Don't use `db:push` in production
- Don't modify migration files manually
- Don't expose Prisma client directly to frontend
- Don't forget to disconnect in scripts
- Don't use `deleteMany` without WHERE clause (deletes all!)
- Don't create circular relations
- Don't ignore migration errors

## Error Handling

```typescript
import { Prisma } from "@buttergolf/db";

try {
  const course = await db.course.create({
    data: { name: "New Course" },
  });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === "P2002") {
      console.error("Course name already exists");
    }
    // Foreign key constraint violation
    if (error.code === "P2003") {
      console.error("Referenced record does not exist");
    }
    // Record not found
    if (error.code === "P2025") {
      console.error("Record not found");
    }
  } else {
    console.error("Unknown error:", error);
  }
}
```

## Common Error Codes

| Code  | Description                      |
| ----- | -------------------------------- |
| P2002 | Unique constraint violation      |
| P2003 | Foreign key constraint violation |
| P2025 | Record not found                 |
| P2015 | Related record not found         |
| P2016 | Query interpretation error       |

## Testing

```typescript
import { prisma } from "@buttergolf/db";

describe("Course", () => {
  beforeEach(async () => {
    // Clean database before each test
    await db.booking.deleteMany();
    await db.hole.deleteMany();
    await db.course.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates a course", async () => {
    const course = await db.course.create({
      data: {
        name: "Test Course",
        location: "Test Location",
      },
    });

    expect(course.name).toBe("Test Course");
  });
});
```

## Performance Tips

- Use `select` instead of `include` when you don't need all fields
- Paginate large result sets
- Use indexes on frequently queried fields
- Batch operations when possible
- Use connection pooling in production
- Monitor query performance with Prisma logs
- Avoid N+1 queries (use `include` or batch queries)

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
