import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  ApiRequestError,
  fetchStores,
  processDeduction,
} from "../lib/api";
import type { CatalogStore } from "../lib/api";

const DeductionPage = () => {
  const [storeId, setStoreId] = useState("");
  const [deductionId, setDeductionId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
  });

  const processDeductionMutation = useMutation({
    mutationFn: processDeduction,
  });

  const selectedStore = storesQuery.data?.find(
    (store) => store.storeId === storeId,
  );
  const apiMessage =
    processDeductionMutation.error instanceof ApiRequestError
      ? processDeductionMutation.error.message
      : null;
  const storeInvalid =
    (formError !== null && storeId.trim() === "") ||
    apiMessage === "Invalid storeId";
  const deductionInvalid =
    (formError !== null && deductionId.trim() === "") ||
    apiMessage === "Invalid deductionId";

  const handleSelectStore = (nextStoreId: string) => {
    setStoreId(nextStoreId);
    setDeductionId("");
    setFormError(null);
  };

  const handleSelectDeduction = (
    nextStoreId: string,
    nextDeductionId: string,
  ) => {
    setStoreId(nextStoreId);
    setDeductionId(nextDeductionId);
    setFormError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (storeId === "" || deductionId === "") {
      setFormError("Choose a store and a deduction.");
      return;
    }

    setFormError(null);
    processDeductionMutation.mutate({ storeId, deductionId });
  };

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Stores in the database</h2>
        <p className="mt-1 text-sm text-stone-600">
          These store IDs already exist. Pick one, then pick one of its
          deductions. Nothing is created here.
        </p>
        <StoreList
          stores={storesQuery.data}
          isPending={storesQuery.isPending}
          isError={storesQuery.isError}
          selectedStoreId={storeId}
          onSelectStore={handleSelectStore}
        />
      </section>

      {selectedStore ? (
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Deductions for store {selectedStore.storeId}
          </h2>
          <DeductionList
            store={selectedStore}
            selectedDeductionId={deductionId}
            onSelectDeduction={handleSelectDeduction}
          />
        </section>
      ) : null}

      <form
        className="grid gap-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
        noValidate
      >
        <p className="text-sm text-stone-600">
          Selected store ID {storeId || "none"}. Selected deduction ID{" "}
          {deductionId || "none"}.
        </p>
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="deductionId" value={deductionId} />
        {formError ? (
          <p id="form-error" className="text-sm text-rose-700" role="alert">
            {formError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={processDeductionMutation.isPending}
          aria-invalid={storeInvalid || deductionInvalid}
          aria-describedby={formError ? "form-error" : undefined}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {processDeductionMutation.isPending
            ? "Processing"
            : "Process deduction"}
        </button>
      </form>

      {processDeductionMutation.isSuccess ? (
        <section
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-6"
          aria-live="polite"
        >
          <h2 className="text-lg font-semibold">
            {processDeductionMutation.data.message}
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Count
              label="Removed"
              value={processDeductionMutation.data.expenseEventsRemoved}
            />
            <Count
              label="Created"
              value={processDeductionMutation.data.expenseEventsCreated}
            />
            <Count
              label="Updated"
              value={processDeductionMutation.data.expenseEventsUpdated}
            />
          </dl>
        </section>
      ) : null}

      {apiMessage ? (
        <p
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          {apiMessage}
        </p>
      ) : null}
    </div>
  );
};

const StoreList = ({
  stores,
  isPending,
  isError,
  selectedStoreId,
  onSelectStore,
}: {
  stores: CatalogStore[] | undefined;
  isPending: boolean;
  isError: boolean;
  selectedStoreId: string;
  onSelectStore: (storeId: string) => void;
}) => {
  if (isPending) {
    return <p className="mt-4 text-sm text-stone-500">Loading stores</p>;
  }

  if (isError) {
    return (
      <p className="mt-4 text-sm text-rose-700" role="alert">
        Could not load stores.
      </p>
    );
  }

  if (!stores || stores.length === 0) {
    return (
      <p className="mt-4 text-sm text-stone-500">No stores are stored yet.</p>
    );
  }

  return (
    <ul className="mt-4 grid gap-2">
      {stores.map((store) => {
        const isSelected = store.storeId === selectedStoreId;
        const className = isSelected
          ? "w-full rounded-lg border border-stone-900 bg-stone-900 px-4 py-3 text-left text-white"
          : "w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-left text-stone-900";

        return (
          <li key={store.storeId}>
            <button
              type="button"
              className={className}
              aria-pressed={isSelected}
              onClick={() => {
                onSelectStore(store.storeId);
              }}
            >
              <span className="block text-sm font-semibold">
                Store {store.storeId}
              </span>
              <span className="mt-1 block text-sm opacity-80">
                {store.marketplaceType} · {store.marketplaceCountry} ·{" "}
                {store.sourceSystemId} · {store.deductions.length} deductions
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const DeductionList = ({
  store,
  selectedDeductionId,
  onSelectDeduction,
}: {
  store: CatalogStore;
  selectedDeductionId: string;
  onSelectDeduction: (storeId: string, deductionId: string) => void;
}) => {
  if (store.deductions.length === 0) {
    return (
      <p className="mt-4 text-sm text-stone-500">
        Store {store.storeId} has no deductions.
      </p>
    );
  }

  return (
    <ul className="mt-4 grid gap-2">
      {store.deductions.map((deduction) => {
        const isSelected = deduction.deductionId === selectedDeductionId;
        const className = isSelected
          ? "w-full rounded-lg border border-stone-900 bg-stone-100 px-4 py-3 text-left"
          : "w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-left";
        const statusLabel = deduction.isActive ? "active" : "inactive";

        return (
          <li key={deduction.deductionId}>
            <button
              type="button"
              className={className}
              aria-pressed={isSelected}
              onClick={() => {
                onSelectDeduction(store.storeId, deduction.deductionId);
              }}
            >
              <span className="block text-sm font-semibold">
                Deduction {deduction.deductionId}
              </span>
              <span className="mt-1 block text-sm text-stone-600">
                {deduction.deductionType} · {deduction.deductionBasis} ·{" "}
                {deduction.deductionValue} · {statusLabel}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const Count = ({ label, value }: { label: string; value: number }) => {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-emerald-800 uppercase">
        {label}
      </dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: DeductionPage,
});
