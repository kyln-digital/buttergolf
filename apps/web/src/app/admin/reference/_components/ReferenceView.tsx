"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Autocomplete,
  Checkbox,
  Column,
  Input,
  Label,
  Radio,
  RadioGroup,
  RadioIndicator,
  Row,
  Text,
} from "@buttergolf/ui";
import { buildAdminUrl } from "@/lib/admin-url";
import { adminCall } from "../../_components/admin-client";
import {
  ActionButton,
  AdminTable,
  CellText,
  FilterChips,
  PageHeader,
  SearchForm,
  Section,
  StatusBadge,
  UrlPagination,
} from "../../_components/AdminUi";

const CLUB_KINDS = [
  "DRIVER",
  "FAIRWAY_WOOD",
  "HYBRID",
  "IRON_SET",
  "WEDGE",
  "PUTTER",
  "BALL",
  "BAG",
  "APPAREL",
  "ACCESSORY",
  "OTHER",
];

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  sortOrder: number;
  products: number;
  models: number;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  products: number;
}

interface ModelRow {
  id: string;
  name: string;
  kind: string;
  isVerified: boolean;
  usageCount: number;
  brand: { id: string; name: string };
}

const BASE = "/admin/reference";

function useMutations(kind: "brands" | "categories" | "club-models") {
  const router = useRouter();
  const create = async (body: unknown) => {
    const result = await adminCall(`/api/admin/reference/${kind}`, { body });
    if (!result.ok) return result.error;
    router.refresh();
    return null;
  };
  const update = async (id: string, body: unknown) => {
    const result = await adminCall(`/api/admin/reference/${kind}/${id}`, { method: "PATCH", body });
    if (!result.ok) return result.error;
    router.refresh();
    return null;
  };
  const remove = async (id: string) => {
    const result = await adminCall(`/api/admin/reference/${kind}/${id}`, { method: "DELETE" });
    if (!result.ok) return result.error;
    router.refresh();
    return null;
  };
  return { create, update, remove };
}

// ─── Brands ──────────────────────────────────────────────────────────────────

function BrandRowEditor({ brand, canManage }: { brand: BrandRow; canManage: boolean }) {
  const { update, remove } = useMutations("brands");
  const [name, setName] = useState(brand.name);
  const [sortOrder, setSortOrder] = useState(String(brand.sortOrder));
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl ?? "");
  const dirty =
    name !== brand.name ||
    Number(sortOrder) !== brand.sortOrder ||
    logoUrl !== (brand.logoUrl ?? "");
  const inUse = brand.products > 0 || brand.models > 0;

  if (!canManage) {
    return (
      <CellText secondary>
        {brand.products} listings · {brand.models} models
      </CellText>
    );
  }

  return (
    <Row gap="$xs" alignItems="center" flexWrap="wrap">
      <Input value={name} onChangeText={setName} size="$3" width={180} placeholder="Name" />
      <Input
        value={sortOrder}
        onChangeText={setSortOrder}
        size="$3"
        width={70}
        inputMode="numeric"
        placeholder="Order"
      />
      <Input
        value={logoUrl}
        onChangeText={setLogoUrl}
        size="$3"
        width={200}
        placeholder="Logo URL"
      />
      <ActionButton
        label="Save"
        variant="primary"
        disabled={!dirty || name.trim().length < 2}
        onRun={() =>
          update(brand.id, {
            name: name.trim(),
            sortOrder: Number.parseInt(sortOrder, 10) || 0,
            logoUrl: logoUrl.trim() || null,
          })
        }
      />
      <ActionButton
        label="Delete"
        tone="error"
        variant="ghost"
        disabled={inUse}
        confirm={`Delete brand "${brand.name}"?`}
        onRun={() => remove(brand.id)}
      />
    </Row>
  );
}

function CreateBrand() {
  const { create } = useMutations("brands");
  const [name, setName] = useState("");
  return (
    <Row gap="$xs" alignItems="center" flexWrap="wrap">
      <Input
        value={name}
        onChangeText={setName}
        size="$4"
        width={240}
        placeholder="New brand name"
      />
      <ActionButton
        label="Add brand"
        variant="primary"
        disabled={name.trim().length < 2}
        onRun={async () => {
          const error = await create({ name: name.trim() });
          if (!error) setName("");
          return error;
        }}
      />
    </Row>
  );
}

// ─── Categories ──────────────────────────────────────────────────────────────

function CategoryRowEditor({ category, canManage }: { category: CategoryRow; canManage: boolean }) {
  const { update, remove } = useMutations("categories");
  const [name, setName] = useState(category.name);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const [description, setDescription] = useState(category.description ?? "");
  const dirty =
    name !== category.name ||
    Number(sortOrder) !== category.sortOrder ||
    description !== (category.description ?? "");

  if (!canManage) return <CellText secondary>{category.products} listings</CellText>;

  return (
    <Row gap="$xs" alignItems="center" flexWrap="wrap">
      <Input value={name} onChangeText={setName} size="$3" width={180} placeholder="Name" />
      <Input
        value={sortOrder}
        onChangeText={setSortOrder}
        size="$3"
        width={70}
        inputMode="numeric"
        placeholder="Order"
      />
      <Input
        value={description}
        onChangeText={setDescription}
        size="$3"
        width={220}
        placeholder="Description"
      />
      <ActionButton
        label="Save"
        variant="primary"
        disabled={!dirty || name.trim().length < 2}
        onRun={() =>
          update(category.id, {
            name: name.trim(),
            sortOrder: Number.parseInt(sortOrder, 10) || 0,
            description: description.trim() || null,
          })
        }
      />
      <ActionButton
        label="Delete"
        tone="error"
        variant="ghost"
        disabled={category.products > 0}
        confirm={`Delete category "${category.name}"?`}
        onRun={() => remove(category.id)}
      />
    </Row>
  );
}

function CreateCategory() {
  const { create } = useMutations("categories");
  const [name, setName] = useState("");
  return (
    <Row gap="$xs" alignItems="center" flexWrap="wrap">
      <Input
        value={name}
        onChangeText={setName}
        size="$4"
        width={240}
        placeholder="New category name"
      />
      <ActionButton
        label="Add category"
        variant="primary"
        disabled={name.trim().length < 2}
        onRun={async () => {
          const error = await create({ name: name.trim() });
          if (!error) setName("");
          return error;
        }}
      />
    </Row>
  );
}

// ─── Club models ─────────────────────────────────────────────────────────────

function ModelRowEditor({ model, canManage }: { model: ModelRow; canManage: boolean }) {
  const { update, remove } = useMutations("club-models");
  const [name, setName] = useState(model.name);
  const [verified, setVerified] = useState(model.isVerified);
  const dirty = name !== model.name || verified !== model.isVerified;

  if (!canManage) {
    return model.isVerified ? (
      <StatusBadge value="VERIFIED" />
    ) : (
      <CellText secondary>unverified</CellText>
    );
  }

  return (
    <Row gap="$xs" alignItems="center" flexWrap="wrap">
      <Input value={name} onChangeText={setName} size="$3" width={220} placeholder="Model name" />
      <Row gap="$xs" alignItems="center">
        <Checkbox id={`verified-${model.id}`} checked={verified} onChange={setVerified} size="sm" />
        <Label
          htmlFor={`verified-${model.id}`}
          size="$3"
          marginBottom={0}
          cursor="pointer"
          color="$text"
        >
          Verified
        </Label>
      </Row>
      <ActionButton
        label="Save"
        variant="primary"
        disabled={!dirty || name.trim().length < 1}
        onRun={() => update(model.id, { name: name.trim(), isVerified: verified })}
      />
      <ActionButton
        label="Delete"
        tone="error"
        variant="ghost"
        confirm={`Delete "${model.brand.name} ${model.name}"? Listings keep their free-text model.`}
        onRun={() => remove(model.id)}
      />
    </Row>
  );
}

function CreateModel({ brands }: { brands: BrandRow[] }) {
  const { create } = useMutations("club-models");
  const [brandQuery, setBrandQuery] = useState("");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("DRIVER");

  const fetchBrands = async (query: string) =>
    brands
      .filter((brand) => brand.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
      .map((brand) => ({ id: brand.id, name: brand.name }));

  return (
    <Column gap="$sm">
      <Row gap="$xs" alignItems="center" flexWrap="wrap">
        <Autocomplete
          value={brandQuery}
          onValueChange={(text) => {
            setBrandQuery(text);
            setBrandId(
              brands.find((brand) => brand.name.toLowerCase() === text.toLowerCase())?.id ?? null
            );
          }}
          onSelectSuggestion={(suggestion) => {
            setBrandQuery(suggestion.name);
            setBrandId(suggestion.id);
          }}
          fetchSuggestions={fetchBrands}
          allowCustom={false}
          minChars={1}
          placeholder="Brand"
          size="$4"
          width={220}
        />
        <Input value={name} onChangeText={setName} size="$4" width={220} placeholder="Model name" />
      </Row>
      <RadioGroup value={kind} onValueChange={setKind} orientation="horizontal" gap="$sm">
        <Row gap="$md" flexWrap="wrap">
          {CLUB_KINDS.map((value) => (
            <Row key={value} alignItems="center" gap="$xs">
              <Radio id={`kind-${value}`} value={value} size="sm">
                <RadioIndicator />
              </Radio>
              <Label
                htmlFor={`kind-${value}`}
                size="$3"
                marginBottom={0}
                cursor="pointer"
                color="$text"
              >
                {value.replace(/_/g, " ")}
              </Label>
            </Row>
          ))}
        </Row>
      </RadioGroup>
      <Row>
        <ActionButton
          label="Add model"
          variant="primary"
          disabled={!brandId || name.trim().length < 1}
          onRun={async () => {
            const error = await create({ brandId, name: name.trim(), kind, isVerified: true });
            if (!error) setName("");
            return error;
          }}
        />
      </Row>
    </Column>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ReferenceView({
  tab,
  brands,
  categories,
  models,
  canManage,
}: {
  tab: "brands" | "categories" | "models";
  brands: BrandRow[];
  categories: CategoryRow[];
  models: { rows: ModelRow[]; q?: string; page: number; totalPages: number; total: number };
  canManage: boolean;
}) {
  return (
    <Column gap="$lg">
      <PageHeader
        title="Reference data"
        description="Brands, categories and club models that listings pick from. Things in use can't be deleted."
      />

      <FilterChips
        options={[
          {
            label: `Brands (${brands.length})`,
            active: tab === "brands",
            href: buildAdminUrl(BASE, { tab: "brands" }),
          },
          {
            label: `Categories (${categories.length})`,
            active: tab === "categories",
            href: buildAdminUrl(BASE, { tab: "categories" }),
          },
          {
            label: `Club models (${models.total})`,
            active: tab === "models",
            href: buildAdminUrl(BASE, { tab: "models" }),
          },
        ]}
      />

      {!canManage && (
        <Text size="$4" color="$textSecondary">
          Editing reference data needs an ADMIN.
        </Text>
      )}

      {tab === "brands" && (
        <Section title="Brands" actions={canManage ? <CreateBrand /> : undefined}>
          <AdminTable
            rows={brands}
            rowKey={(brand) => brand.id}
            columns={[
              {
                key: "name",
                label: "Brand",
                width: 200,
                render: (brand) => (
                  <Column gap={0}>
                    <CellText>{brand.name}</CellText>
                    <CellText secondary>/{brand.slug}</CellText>
                  </Column>
                ),
              },
              {
                key: "use",
                label: "In use",
                width: 140,
                render: (brand) => (
                  <CellText secondary>
                    {brand.products} listings · {brand.models} models
                  </CellText>
                ),
              },
              {
                key: "edit",
                label: "",
                flex: 3,
                render: (brand) => <BrandRowEditor brand={brand} canManage={canManage} />,
              },
            ]}
          />
        </Section>
      )}

      {tab === "categories" && (
        <Section title="Categories" actions={canManage ? <CreateCategory /> : undefined}>
          <AdminTable
            rows={categories}
            rowKey={(category) => category.id}
            columns={[
              {
                key: "name",
                label: "Category",
                width: 200,
                render: (category) => (
                  <Column gap={0}>
                    <CellText>{category.name}</CellText>
                    <CellText secondary>/{category.slug}</CellText>
                  </Column>
                ),
              },
              {
                key: "use",
                label: "In use",
                width: 120,
                render: (category) => <CellText secondary>{category.products} listings</CellText>,
              },
              {
                key: "edit",
                label: "",
                flex: 3,
                render: (category) => (
                  <CategoryRowEditor category={category} canManage={canManage} />
                ),
              },
            ]}
          />
        </Section>
      )}

      {tab === "models" && (
        <Column gap="$md">
          {canManage && (
            <Section title="Add a club model">
              <CreateModel brands={brands} />
            </Section>
          )}
          <SearchForm
            basePath={BASE}
            params={{ tab: "models" }}
            initialValue={models.q}
            placeholder="Search models or brands"
          />
          <AdminTable
            rows={models.rows}
            rowKey={(model) => model.id}
            emptyText="No models match."
            columns={[
              {
                key: "brand",
                label: "Brand",
                width: 150,
                render: (model) => <CellText>{model.brand.name}</CellText>,
              },
              {
                key: "name",
                label: "Model",
                width: 220,
                render: (model) => <CellText>{model.name}</CellText>,
              },
              {
                key: "kind",
                label: "Kind",
                width: 130,
                render: (model) => <CellText secondary>{model.kind.replace(/_/g, " ")}</CellText>,
              },
              {
                key: "usage",
                label: "Used",
                width: 70,
                render: (model) => <CellText secondary>{model.usageCount}</CellText>,
              },
              {
                key: "edit",
                label: "",
                flex: 3,
                render: (model) => <ModelRowEditor model={model} canManage={canManage} />,
              },
            ]}
          />
          <UrlPagination
            basePath={BASE}
            params={{ tab: "models", q: models.q }}
            page={models.page}
            totalPages={models.totalPages}
            total={models.total}
          />
        </Column>
      )}
    </Column>
  );
}
