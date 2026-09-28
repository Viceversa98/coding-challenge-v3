import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import {
  Field,
  Notice,
  Pager,
  cx,
  dangerButton,
  fieldClass,
  primaryButton,
  quietButton,
} from "../components/ui";
import { processDeduction, requestJson } from "../lib/api";

type Tab =
  | "overview"
  | "stores"
  | "products"
  | "sales"
  | "deductions"
  | "events";

type StoreRecord = {
  storeId: string;
  merchantId: string;
  marketplaceType: string;
  marketplaceSubtype: string;
  marketplaceCountry: string;
  sourceSystemId: string;
  isActive: boolean;
  productCount: number;
  deductionCount: number;
};

type ProductRecord = {
  productId: string;
  storeId: string;
  sellerSku: string;
  productSku: string;
  title: string;
  price: string;
  brand: string | null;
  fulfilledBy: string;
  isActive: boolean;
};

type SaleRecord = {
  productId: string;
  storeId: string;
  productSku: string;
  title: string;
  reportDate: string;
  shippedRevenue: string;
  shippedUnits: number;
};

type DeductionRecord = {
  deductionId: string;
  storeId: string;
  deductionType: string;
  deductionBasis: "FIXED_AMOUNT" | "NET_RECEIPTS";
  deductionValue: string;
  currency: string;
  vendorCode: string | null;
  effectiveDateFrom: string;
  effectiveDateTo: string;
  isActive: boolean;
};

type ExpenseRecord = {
  storeId: string;
  sourceSystemId: string;
  productSku: string | null;
  expenseDate: string;
  expenseType: string;
  expenseSubtype: string;
  cost: string;
  deductionId: string;
  shippedRevenue: string | null;
  revenueAfter: string | null;
};

type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

type Overview = {
  stores: number;
  products: number;
  sales: number;
  deductions: number;
  sellOutEvents: number;
  otherEvents: number;
  earliestSale: string | null;
  latestSale: string | null;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "How it works" },
  { id: "stores", label: "Stores" },
  { id: "products", label: "Products" },
  { id: "sales", label: "Sales" },
  { id: "deductions", label: "Deductions" },
  { id: "events", label: "Expense events" },
];

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body ? { "Content-Type": "application/json" } : undefined,
  body: body ? JSON.stringify(body) : undefined,
});

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Request failed";

const dayLabel = (value: string): string => value.slice(0, 10);

const money = (value: string): string => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value;
  }
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
};

const WorkbenchPage = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const queryClient = useQueryClient();
  const storesQuery = useQuery({
    queryKey: ["workbench", "stores"],
    queryFn: () => requestJson<{ stores: StoreRecord[] }>("/api/vendors/workbench/stores"),
  });
  const stores = storesQuery.data?.stores ?? [];
  const selected =
    stores.find((store) => store.storeId === search.storeId) ?? null;

  useEffect(() => {
    if (search.storeId === "" && stores[0]) {
      void navigate({
        search: { tab: search.tab, storeId: stores[0].storeId },
        replace: true,
      });
    }
  }, [navigate, search.storeId, search.tab, stores]);

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workbench"] });
    await queryClient.invalidateQueries({ queryKey: ["stores"] });
  };

  const handleTab = (tab: Tab) => {
    void navigate({ search: { tab, storeId: search.storeId } });
  };

  const handleStore = (storeId: string) => {
    void navigate({ search: { tab: search.tab, storeId } });
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-lg border border-line bg-card p-5">
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold">
            Turn marketplace fees into expense events
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            A store sells products. Each day of shipped revenue is a sale. A
            deduction is the fee rule. Processing a net-receipts deduction
            writes one SELL_OUT expense event per sale: shipped revenue times
            the rate.
          </p>
          <p className="font-mono text-sm text-accent">
            cost = shipped revenue × deduction rate
          </p>
        </div>
        <label className="grid max-w-md gap-1 text-sm">
          <span className="font-medium">Working store</span>
          <select
            className={fieldClass}
            value={search.storeId}
            aria-label="Working store"
            onChange={(event) => {
              handleStore(event.target.value);
            }}
          >
            <option value="">Select a store</option>
            {stores.map((store) => (
              <option key={store.storeId} value={store.storeId}>
                {store.storeId} · {store.marketplaceType} ·{" "}
                {store.marketplaceCountry}
              </option>
            ))}
          </select>
        </label>
      </section>

      <nav aria-label="Records" className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const isCurrent = search.tab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isCurrent ? "page" : undefined}
              className={cx(
                "min-h-11 shrink-0 cursor-pointer rounded-md px-3 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                isCurrent
                  ? "bg-accent text-accent-ink"
                  : "bg-panel text-muted hover:text-ink",
              )}
              onClick={() => {
                handleTab(tab.id);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {search.tab === "overview" ? (
        <OverviewPanel storeId={search.storeId} />
      ) : null}
      {search.tab === "stores" ? (
        <StoresPanel stores={stores} onChanged={refreshAll} />
      ) : null}
      {search.tab === "products" && selected ? (
        <ProductsPanel store={selected} onChanged={refreshAll} />
      ) : null}
      {search.tab === "sales" && selected ? (
        <SalesPanel store={selected} onChanged={refreshAll} />
      ) : null}
      {search.tab === "deductions" && selected ? (
        <DeductionsPanel store={selected} onChanged={refreshAll} />
      ) : null}
      {search.tab === "events" && selected ? (
        <EventsPanel store={selected} onChanged={refreshAll} />
      ) : null}
      {search.tab !== "overview" && search.tab !== "stores" && !selected ? (
        <Notice tone="error">Select a store before editing its records.</Notice>
      ) : null}
    </div>
  );
};

const OverviewPanel = ({ storeId }: { storeId: string }) => {
  const overviewQuery = useQuery({
    queryKey: ["workbench", "overview", storeId],
    queryFn: () =>
      requestJson<Overview>(
        storeId === ""
          ? "/api/vendors/workbench/overview"
          : `/api/vendors/workbench/overview?storeId=${storeId}`,
      ),
  });

  return (
    <section className="grid gap-4">
      <ol className="grid gap-3 md:grid-cols-4">
        <Step
          index="1"
          title="Store"
          body="A marketplace account. Products, sales, and fees belong to it."
        />
        <Step
          index="2"
          title="Sale"
          body="Shipped revenue for one product on one day. That revenue is the fee base."
        />
        <Step
          index="3"
          title="Deduction"
          body="The fee rule. Net receipts means a rate, such as 0.10 for 10 percent."
        />
        <Step
          index="4"
          title="Expense event"
          body="The calculated fee. Processing writes one SELL_OUT row per matching sale."
        />
      </ol>
      {overviewQuery.data ? (
        <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Stores" value={overviewQuery.data.stores} />
          <Metric label="Products" value={overviewQuery.data.products} />
          <Metric label="Sales" value={overviewQuery.data.sales} />
          <Metric label="Deductions" value={overviewQuery.data.deductions} />
          <Metric label="SELL_OUT events" value={overviewQuery.data.sellOutEvents} />
          <Metric label="Other events" value={overviewQuery.data.otherEvents} />
        </dl>
      ) : null}
      <p className="text-sm leading-6 text-muted">
        Other events are seeded chargebacks. They are not produced by this
        endpoint. Only an active NET_RECEIPTS deduction, and only sales inside
        its date range, become SELL_OUT expense events. A $10,000 sale at rate
        0.10 becomes a $1,000 event.
      </p>
    </section>
  );
};

const StoresPanel = ({
  stores,
  onChanged,
}: {
  stores: StoreRecord[];
  onChanged: () => Promise<void>;
}) => {
  const [editing, setEditing] = useState<StoreRecord | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (storeId: string) =>
      requestJson<void>(
        `/api/vendors/workbench/stores/${storeId}`,
        jsonInit("DELETE"),
      ),
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (mutationError) => {
      setError(messageOf(mutationError));
    },
  });

  return (
    <Panel
      title="Stores"
      body="The marketplace identity is the key. Products copy that marketplace from the store. Deleting a store also deletes its products, sales, and deductions."
      action={
        <button
          type="button"
          className={primaryButton}
          onClick={() => {
            setEditing("new");
          }}
        >
          New store
        </button>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {editing ? (
        <StoreForm
          store={editing === "new" ? null : editing}
          onCancel={() => {
            setEditing(null);
          }}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      ) : null}
      <DataTable
        headers={["Id", "Marketplace", "Merchant", "Products", "Deductions", ""]}
        rows={stores.map((store) => [
          store.storeId,
          `${store.marketplaceType} / ${store.marketplaceCountry}`,
          store.merchantId,
          String(store.productCount),
          String(store.deductionCount),
          <RowActions
            key={store.storeId}
            onEdit={() => {
              setEditing(store);
            }}
            onDelete={() => {
              remove.mutate(store.storeId);
            }}
            deleteLabel={`Delete store ${store.storeId}`}
          />,
        ])}
      />
    </Panel>
  );
};

const StoreForm = ({
  store,
  onCancel,
  onSaved,
}: {
  store: StoreRecord | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) => {
  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const body = {
        merchantId: String(form.get("merchantId") ?? ""),
        marketplaceType: String(form.get("marketplaceType") ?? ""),
        marketplaceSubtype: String(form.get("marketplaceSubtype") ?? ""),
        marketplaceCountry: String(form.get("marketplaceCountry") ?? ""),
        sourceSystemId: String(form.get("sourceSystemId") ?? ""),
        isActive: form.get("isActive") === "on",
      };
      if (store) {
        return requestJson(
          `/api/vendors/workbench/stores/${store.storeId}`,
          jsonInit("PATCH", {
            merchantId: body.merchantId,
            isActive: body.isActive,
          }),
        );
      }
      return requestJson("/api/vendors/workbench/stores", jsonInit("POST", body));
    },
    onSuccess: onSaved,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(new FormData(event.currentTarget));
  };

  return (
    <form className="grid gap-3 rounded-md border border-line bg-panel p-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Merchant id">
          <input className={fieldClass} name="merchantId" defaultValue={store?.merchantId ?? ""} required />
        </Field>
        <Field label="Marketplace" hint={store ? "Identity stays fixed after create." : undefined}>
          <input className={fieldClass} name="marketplaceType" defaultValue={store?.marketplaceType ?? "amazon"} required disabled={store !== null} />
        </Field>
        <Field label="Subtype">
          <input className={fieldClass} name="marketplaceSubtype" defaultValue={store?.marketplaceSubtype ?? "amazon"} required disabled={store !== null} />
        </Field>
        <Field label="Country">
          <input className={fieldClass} name="marketplaceCountry" defaultValue={store?.marketplaceCountry ?? "US"} required disabled={store !== null} />
        </Field>
        <Field label="Source system id">
          <input className={fieldClass} name="sourceSystemId" defaultValue={store?.sourceSystemId ?? ""} required disabled={store !== null} />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={store?.isActive ?? true} />
          Active store
        </label>
      </div>
      {save.error ? <Notice tone="error">{messageOf(save.error)}</Notice> : null}
      <FormActions onCancel={onCancel} pending={save.isPending} />
    </form>
  );
};

const ProductsPanel = ({
  store,
  onChanged,
}: {
  store: StoreRecord;
  onChanged: () => Promise<void>;
}) => {
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<ProductRecord | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const productsQuery = useQuery({
    queryKey: ["workbench", "products", store.storeId, offset],
    queryFn: () =>
      requestJson<Page<ProductRecord>>(
        `/api/vendors/workbench/products?storeId=${store.storeId}&limit=20&offset=${offset}`,
      ),
  });

  useEffect(() => {
    setOffset(0);
    setEditing(null);
  }, [store.storeId]);

  const remove = useMutation({
    mutationFn: (productId: string) =>
      requestJson<void>(
        `/api/vendors/workbench/products/${productId}`,
        jsonInit("DELETE"),
      ),
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (mutationError) => {
      setError(messageOf(mutationError));
    },
  });

  return (
    <Panel
      title={`Products in store ${store.storeId}`}
      body="A product is what the vendor sells. Its SKU later appears on the expense event so you can see which item the fee hit."
      action={
        <button type="button" className={primaryButton} onClick={() => setEditing("new")}>
          New product
        </button>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {editing ? (
        <ProductForm
          storeId={store.storeId}
          product={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      ) : null}
      {productsQuery.isError ? (
        <Notice tone="error">{messageOf(productsQuery.error)}</Notice>
      ) : (
        <DataTable
          headers={["Id", "Title", "SKU", "Price", "Fulfilled by", ""]}
          rows={(productsQuery.data?.items ?? []).map((product) => [
            product.productId,
            product.title,
            product.productSku,
            money(product.price),
            product.fulfilledBy,
            <RowActions
              key={product.productId}
              onEdit={() => setEditing(product)}
              onDelete={() => remove.mutate(product.productId)}
              deleteLabel={`Delete product ${product.title}`}
            />,
          ])}
        />
      )}
      {productsQuery.data ? (
        <Pager offset={productsQuery.data.offset} limit={productsQuery.data.limit} total={productsQuery.data.total} onPage={setOffset} />
      ) : null}
    </Panel>
  );
};

const ProductForm = ({
  storeId,
  product,
  onCancel,
  onSaved,
}: {
  storeId: string;
  product: ProductRecord | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) => {
  const save = useMutation({
    mutationFn: (form: FormData) => {
      const body = {
        storeId,
        sellerSku: String(form.get("sellerSku") ?? ""),
        productSku: String(form.get("productSku") ?? ""),
        title: String(form.get("title") ?? ""),
        price: String(form.get("price") ?? ""),
        brand: String(form.get("brand") ?? "") || null,
        fulfilledBy: String(form.get("fulfilledBy") ?? "FBA"),
        isActive: form.get("isActive") === "on",
      };
      if (product) {
        const { storeId: _storeId, ...patch } = body;
        return requestJson(
          `/api/vendors/workbench/products/${product.productId}`,
          jsonInit("PATCH", patch),
        );
      }
      return requestJson("/api/vendors/workbench/products", jsonInit("POST", body));
    },
    onSuccess: onSaved,
  });

  return (
    <form
      className="grid gap-3 rounded-md border border-line bg-panel p-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(new FormData(event.currentTarget));
      }}
    >
      <Field label="Title">
        <input className={fieldClass} name="title" defaultValue={product?.title ?? ""} required />
      </Field>
      <Field label="Seller SKU">
        <input className={fieldClass} name="sellerSku" defaultValue={product?.sellerSku ?? ""} required />
      </Field>
      <Field label="Product SKU">
        <input className={fieldClass} name="productSku" defaultValue={product?.productSku ?? ""} required />
      </Field>
      <Field label="Price" hint="Catalog price. Fees use shipped revenue, not this price.">
        <input className={fieldClass} name="price" inputMode="decimal" defaultValue={product?.price ?? "19.99"} required />
      </Field>
      <Field label="Brand">
        <input className={fieldClass} name="brand" defaultValue={product?.brand ?? ""} />
      </Field>
      <Field label="Fulfilled by">
        <select className={fieldClass} name="fulfilledBy" defaultValue={product?.fulfilledBy ?? "FBA"}>
          <option value="FBA">FBA</option>
          <option value="FBM">FBM</option>
        </select>
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} />
        Active product
      </label>
      {save.error ? <Notice tone="error">{messageOf(save.error)}</Notice> : null}
      <FormActions onCancel={onCancel} pending={save.isPending} />
    </form>
  );
};

const SalesPanel = ({
  store,
  onChanged,
}: {
  store: StoreRecord;
  onChanged: () => Promise<void>;
}) => {
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<SaleRecord | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const salesQuery = useQuery({
    queryKey: ["workbench", "sales", store.storeId, offset],
    queryFn: () =>
      requestJson<Page<SaleRecord>>(
        `/api/vendors/workbench/sales?storeId=${store.storeId}&limit=20&offset=${offset}`,
      ),
  });
  const productsQuery = useQuery({
    queryKey: ["workbench", "product-options", store.storeId],
    queryFn: () =>
      requestJson<Page<ProductRecord>>(
        `/api/vendors/workbench/products?storeId=${store.storeId}&limit=50&offset=0`,
      ),
  });

  useEffect(() => {
    setOffset(0);
    setEditing(null);
  }, [store.storeId]);

  const remove = useMutation({
    mutationFn: (sale: SaleRecord) => {
      const params = new URLSearchParams({
        productId: sale.productId,
        storeId: sale.storeId,
        reportDate: sale.reportDate,
      });
      return requestJson<void>(
        `/api/vendors/workbench/sales?${params.toString()}`,
        jsonInit("DELETE"),
      );
    },
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (mutationError) => setError(messageOf(mutationError)),
  });

  return (
    <Panel
      title={`Sales for store ${store.storeId}`}
      body="Shipped revenue is the only number the fee uses. One row is one product on one day. Processing includes a sale only when that day sits inside the deduction's dates."
      action={
        <button type="button" className={primaryButton} onClick={() => setEditing("new")}>
          New sale
        </button>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {editing ? (
        <SaleForm
          storeId={store.storeId}
          products={productsQuery.data?.items ?? []}
          sale={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      ) : null}
      <DataTable
        headers={["Date", "Product", "SKU", "Shipped revenue", "Units", ""]}
        rows={(salesQuery.data?.items ?? []).map((sale) => [
          dayLabel(sale.reportDate),
          sale.title,
          sale.productSku,
          money(sale.shippedRevenue),
          String(sale.shippedUnits),
          <RowActions
            key={`${sale.productId}-${sale.reportDate}`}
            onEdit={() => setEditing(sale)}
            onDelete={() => remove.mutate(sale)}
            deleteLabel={`Delete sale for ${sale.title} on ${dayLabel(sale.reportDate)}`}
          />,
        ])}
      />
      {salesQuery.data ? (
        <Pager offset={salesQuery.data.offset} limit={salesQuery.data.limit} total={salesQuery.data.total} onPage={setOffset} />
      ) : null}
    </Panel>
  );
};

const SaleForm = ({
  storeId,
  products,
  sale,
  onCancel,
  onSaved,
}: {
  storeId: string;
  products: ProductRecord[];
  sale: SaleRecord | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) => {
  const save = useMutation({
    mutationFn: (form: FormData) => {
      const shippedRevenue = String(form.get("shippedRevenue") ?? "");
      if (sale) {
        return requestJson(
          "/api/vendors/workbench/sales",
          jsonInit("PATCH", {
            productId: sale.productId,
            storeId: sale.storeId,
            reportDate: sale.reportDate,
            shippedRevenue,
          }),
        );
      }
      return requestJson(
        "/api/vendors/workbench/sales",
        jsonInit("POST", {
          storeId,
          productId: String(form.get("productId") ?? ""),
          reportDate: String(form.get("reportDate") ?? ""),
          shippedRevenue,
        }),
      );
    },
    onSuccess: onSaved,
  });

  return (
    <form
      className="grid gap-3 rounded-md border border-line bg-panel p-4 md:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(new FormData(event.currentTarget));
      }}
    >
      {sale ? (
        <p className="text-sm text-muted md:col-span-3">
          Editing shipped revenue for {sale.title} on {dayLabel(sale.reportDate)}. Process the deduction again to refresh the expense event.
        </p>
      ) : (
        <>
          <Field label="Product">
            <select className={fieldClass} name="productId" required defaultValue={products[0]?.productId ?? ""}>
              {products.map((product) => (
                <option key={product.productId} value={product.productId}>
                  {product.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Report date">
            <input className={fieldClass} type="date" name="reportDate" required />
          </Field>
        </>
      )}
      <Field label="Shipped revenue" hint="Example: 10000.00 with rate 0.10 creates a 1000.00 expense.">
        <input className={fieldClass} name="shippedRevenue" inputMode="decimal" defaultValue={sale?.shippedRevenue ?? "10000.00"} required />
      </Field>
      {save.error ? <Notice tone="error">{messageOf(save.error)}</Notice> : null}
      <FormActions onCancel={onCancel} pending={save.isPending} />
    </form>
  );
};

const DeductionsPanel = ({
  store,
  onChanged,
}: {
  store: StoreRecord;
  onChanged: () => Promise<void>;
}) => {
  const [editing, setEditing] = useState<DeductionRecord | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const deductionsQuery = useQuery({
    queryKey: ["workbench", "deductions", store.storeId],
    queryFn: () =>
      requestJson<{ deductions: DeductionRecord[] }>(
        `/api/vendors/workbench/deductions?storeId=${store.storeId}`,
      ),
  });
  const windowQuery = useQuery({
    queryKey: ["workbench", "overview", store.storeId],
    queryFn: () =>
      requestJson<Overview>(
        `/api/vendors/workbench/overview?storeId=${store.storeId}`,
      ),
  });
  const saleWindow = windowQuery.data;
  const missed = (deductionsQuery.data?.deductions ?? []).filter((deduction) =>
    datesMissSales(
      deduction.effectiveDateFrom,
      deduction.effectiveDateTo,
      saleWindow?.earliestSale ?? null,
      saleWindow?.latestSale ?? null,
    ),
  );

  const remove = useMutation({
    mutationFn: (deductionId: string) =>
      requestJson<void>(
        `/api/vendors/workbench/deductions/${deductionId}`,
        jsonInit("DELETE"),
      ),
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (mutationError) => setError(messageOf(mutationError)),
  });

  const process = useMutation({
    mutationFn: (deductionId: string) =>
      processDeduction({ storeId: store.storeId, deductionId }),
    onSuccess: async (data, deductionId) => {
      setError(null);
      const deduction = deductionsQuery.data?.deductions.find(
        (item) => item.deductionId === deductionId,
      );
      const missedSales =
        deduction !== undefined &&
        datesMissSales(
          deduction.effectiveDateFrom,
          deduction.effectiveDateTo,
          saleWindow?.earliestSale ?? null,
          saleWindow?.latestSale ?? null,
        );
      setResult(
        missedSales
          ? `The deduction is saved, but no expense events were written. Its dates (${dayLabel(deduction.effectiveDateFrom)} to ${dayLabel(deduction.effectiveDateTo)}) do not cover this store's sales (${dayLabel(saleWindow?.earliestSale ?? "")} to ${dayLabel(saleWindow?.latestSale ?? "")}).`
          : `${data.message}. Removed ${data.expenseEventsRemoved}, created ${data.expenseEventsCreated}, updated ${data.expenseEventsUpdated}.`,
      );
      await onChanged();
    },
    onError: (mutationError) => {
      setResult(null);
      setError(messageOf(mutationError));
    },
  });

  return (
    <Panel
      title={`Deductions for store ${store.storeId}`}
      body="A deduction is the fee. NET_RECEIPTS stores a rate: 0.10 means 10 percent of shipped revenue. FIXED_AMOUNT is saved here, but processing it removes SELL_OUT events and returns an error. Inactive deductions remove their events and create none."
      action={
        <button type="button" className={primaryButton} onClick={() => setEditing("new")}>
          New deduction
        </button>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {result ? <Notice tone={result.startsWith("The deduction is saved") ? "error" : "ok"}>{result}</Notice> : null}
      {missed.length > 0 && saleWindow?.earliestSale && saleWindow.latestSale ? (
        <Notice tone="error">
          These deductions are saved, but their dates miss this store&apos;s
          sales ({dayLabel(saleWindow.earliestSale)} to{" "}
          {dayLabel(saleWindow.latestSale)}), so Process writes no expense
          events: {missed.map((item) => item.deductionType).join(", ")}.
        </Notice>
      ) : null}
      {editing ? (
        <DeductionForm
          storeId={store.storeId}
          deduction={editing === "new" ? null : editing}
          defaultFrom={saleWindow?.earliestSale ? dayLabel(saleWindow.earliestSale) : "2026-03-29"}
          defaultTo={saleWindow?.latestSale ? dayLabel(saleWindow.latestSale) : "2026-09-24"}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      ) : null}
      <DataTable
        headers={["Id", "Type", "Basis", "Rate", "Dates", "Status", ""]}
        rows={(deductionsQuery.data?.deductions ?? []).map((deduction) => [
          deduction.deductionId,
          deduction.deductionType,
          deduction.deductionBasis === "NET_RECEIPTS" ? "Percent of revenue" : "Fixed amount",
          deduction.deductionValue,
          `${dayLabel(deduction.effectiveDateFrom)} to ${dayLabel(deduction.effectiveDateTo)}`,
          deduction.isActive ? "Active" : "Inactive",
          <div key={deduction.deductionId} className="flex flex-wrap gap-2">
            <button type="button" className={primaryButton} onClick={() => process.mutate(deduction.deductionId)}>
              Process
            </button>
            <RowActions
              onEdit={() => setEditing(deduction)}
              onDelete={() => remove.mutate(deduction.deductionId)}
              deleteLabel={`Delete deduction ${deduction.deductionType}`}
            />
          </div>,
        ])}
      />
    </Panel>
  );
};

const datesMissSales = (
  from: string,
  to: string,
  earliest: string | null,
  latest: string | null,
): boolean => {
  if (!earliest || !latest) {
    return false;
  }
  return dayLabel(to) < dayLabel(earliest) || dayLabel(from) > dayLabel(latest);
};

const DeductionForm = ({
  storeId,
  deduction,
  defaultFrom,
  defaultTo,
  onCancel,
  onSaved,
}: {
  storeId: string;
  deduction: DeductionRecord | null;
  defaultFrom: string;
  defaultTo: string;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) => {
  const [basis, setBasis] = useState(deduction?.deductionBasis ?? "NET_RECEIPTS");
  const [rate, setRate] = useState(deduction?.deductionValue ?? "0.10");
  const preview = Number(rate);
  const sample = Number.isFinite(preview) ? (10000 * preview).toFixed(2) : "";

  const save = useMutation({
    mutationFn: (form: FormData) => {
      const body = {
        storeId,
        deductionType: String(form.get("deductionType") ?? ""),
        deductionBasis: String(form.get("deductionBasis") ?? "NET_RECEIPTS"),
        deductionValue: String(form.get("deductionValue") ?? ""),
        currency: String(form.get("currency") ?? "USD"),
        vendorCode: String(form.get("vendorCode") ?? "") || null,
        effectiveDateFrom: String(form.get("effectiveDateFrom") ?? ""),
        effectiveDateTo: String(form.get("effectiveDateTo") ?? ""),
        isActive: form.get("isActive") === "on",
      };
      if (deduction) {
        const { storeId: _storeId, ...patch } = body;
        return requestJson(
          `/api/vendors/workbench/deductions/${deduction.deductionId}`,
          jsonInit("PATCH", patch),
        );
      }
      return requestJson("/api/vendors/workbench/deductions", jsonInit("POST", body));
    },
    onSuccess: onSaved,
  });

  return (
    <form
      className="grid gap-3 rounded-md border border-line bg-panel p-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(new FormData(event.currentTarget));
      }}
    >
      <Field label="Type" hint="Becomes the expense subtype, for example Marketing Fee.">
        <input className={fieldClass} name="deductionType" defaultValue={deduction?.deductionType ?? "Marketing Fee"} required />
      </Field>
      <Field label="Basis">
        <select
          className={fieldClass}
          name="deductionBasis"
          value={basis}
          onChange={(event) => {
            setBasis(event.target.value as DeductionRecord["deductionBasis"]);
          }}
        >
          <option value="NET_RECEIPTS">NET_RECEIPTS</option>
          <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
        </select>
      </Field>
      <Field
        label="Value"
        hint={
          basis === "NET_RECEIPTS"
            ? "Store 0.10 for 10 percent. Do not store 10."
            : "The processor does not apply fixed amounts."
        }
      >
        <input
          className={fieldClass}
          name="deductionValue"
          inputMode="decimal"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
          required
        />
      </Field>
      <Field label="Currency">
        <input className={fieldClass} name="currency" defaultValue={deduction?.currency ?? "USD"} required />
      </Field>
      <Field label="Effective from">
        <input className={fieldClass} type="date" name="effectiveDateFrom" defaultValue={deduction ? dayLabel(deduction.effectiveDateFrom) : defaultFrom} required />
      </Field>
      <Field label="Effective to" hint="Only sales inside these dates become expense events.">
        <input className={fieldClass} type="date" name="effectiveDateTo" defaultValue={deduction ? dayLabel(deduction.effectiveDateTo) : defaultTo} required />
      </Field>
      <Field label="Vendor code">
        <input className={fieldClass} name="vendorCode" defaultValue={deduction?.vendorCode ?? ""} />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={deduction?.isActive ?? true} />
        Active. Inactive removes existing events and creates none.
      </label>
      {basis === "NET_RECEIPTS" && sample !== "" ? (
        <p className="font-mono text-sm text-accent md:col-span-2">
          $10,000.00 × {rate || "0"} = {money(sample)}
        </p>
      ) : null}
      {save.error ? <Notice tone="error">{messageOf(save.error)}</Notice> : null}
      <FormActions onCancel={onCancel} pending={save.isPending} />
    </form>
  );
};

const EventsPanel = ({
  store,
  onChanged,
}: {
  store: StoreRecord;
  onChanged: () => Promise<void>;
}) => {
  const [offset, setOffset] = useState(0);
  const [expenseType, setExpenseType] = useState("SELL_OUT");
  const [error, setError] = useState<string | null>(null);
  const eventsQuery = useQuery({
    queryKey: ["workbench", "events", store.storeId, expenseType, offset],
    queryFn: () => {
      const params = new URLSearchParams({
        storeId: store.storeId,
        limit: "20",
        offset: String(offset),
      });
      if (expenseType !== "ALL") {
        params.set("expenseType", expenseType);
      }
      return requestJson<Page<ExpenseRecord>>(
        `/api/vendors/workbench/expense-events?${params.toString()}`,
      );
    },
  });

  useEffect(() => {
    setOffset(0);
  }, [store.storeId, expenseType]);

  const remove = useMutation({
    mutationFn: (event: ExpenseRecord) =>
      requestJson<void>(
        "/api/vendors/workbench/expense-events",
        jsonInit("DELETE", event),
      ),
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (mutationError) => setError(messageOf(mutationError)),
  });

  return (
    <Panel
      title={`Expense events for store ${store.storeId}`}
      body="Before is shipped revenue. Fee is the deduction taken from it. After is what remains. The deduction id sits beside the subtype."
      action={
        <label className="grid gap-1 text-sm">
          <span className="sr-only">Expense type</span>
          <select
            className={fieldClass}
            value={expenseType}
            aria-label="Expense type"
            onChange={(event) => setExpenseType(event.target.value)}
          >
            <option value="SELL_OUT">SELL_OUT</option>
            <option value="chargebacks">Chargebacks</option>
            <option value="ALL">All types</option>
          </select>
        </label>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <DataTable
        headers={["Date", "Type", "Subtype", "SKU", "Before deduction", "Fee", "After deduction", ""]}
        rows={(eventsQuery.data?.items ?? []).map((event) => [
          dayLabel(event.expenseDate),
          event.expenseType,
          <span key={event.deductionId} className="inline-flex items-baseline gap-2">
            {event.expenseSubtype}
            {event.deductionId !== "0" ? (
              <span className="font-mono text-xs text-muted" aria-label={`Deduction ${event.deductionId}`}>
                {event.deductionId}
              </span>
            ) : null}
          </span>,
          event.productSku ?? "—",
          event.shippedRevenue ? money(event.shippedRevenue) : "—",
          money(event.cost),
          event.revenueAfter ? money(event.revenueAfter) : "—",
          <button
            key={`${event.sourceSystemId}-${event.expenseDate}-${event.expenseSubtype}-${event.deductionId}`}
            type="button"
            className={dangerButton}
            onClick={() => remove.mutate(event)}
          >
            Delete
          </button>,
        ])}
      />
      {eventsQuery.data ? (
        <Pager offset={eventsQuery.data.offset} limit={eventsQuery.data.limit} total={eventsQuery.data.total} onPage={setOffset} />
      ) : null}
    </Panel>
  );
};

const Step = ({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) => (
  <li className="rounded-lg border border-line bg-panel p-4">
    <p className="font-mono text-xs text-accent">Step {index}</p>
    <h3 className="mt-1 font-semibold">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
  </li>
);

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-line bg-panel px-3 py-3">
    <dt className="text-xs text-muted">{label}</dt>
    <dd className="font-mono text-2xl font-semibold">{value.toLocaleString("en-US")}</dd>
  </div>
);

const Panel = ({
  title,
  body,
  action,
  children,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="grid gap-4 rounded-lg border border-line bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const DataTable = ({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[720px] border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-line text-muted">
          {headers.map((header) => (
            <th key={header} className="px-2 py-2 font-medium">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="px-2 py-4 text-muted" colSpan={headers.length}>
              Nothing stored for this view yet.
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={index} className="border-b border-line/70">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-2 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const RowActions = ({
  onEdit,
  onDelete,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel: string;
}) => (
  <div className="flex flex-wrap gap-2">
    <button type="button" className={quietButton} onClick={onEdit}>
      Edit
    </button>
    <button type="button" className={dangerButton} aria-label={deleteLabel} onClick={onDelete}>
      Delete
    </button>
  </div>
);

const FormActions = ({
  onCancel,
  pending,
}: {
  onCancel: () => void;
  pending: boolean;
}) => (
  <div className="flex flex-wrap gap-2 md:col-span-2">
    <button type="submit" className={primaryButton} disabled={pending}>
      {pending ? "Saving" : "Save"}
    </button>
    <button type="button" className={quietButton} onClick={onCancel}>
      Cancel
    </button>
  </div>
);

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const tab = tabs.some((item) => item.id === search.tab)
      ? (search.tab as Tab)
      : "overview";
    const storeId = typeof search.storeId === "string" ? search.storeId : "";
    return { tab, storeId };
  },
  component: WorkbenchPage,
});
