import { Button, Input, Select, type SelectOption } from "@/components/ui";
import type { ReferenceData } from "./business-profile-form.types";
import {
  createInitialBusinessProduct,
  digitsOnly,
  type BusinessProductForm,
} from "./business-profile-form.validation";
import type { BusinessFormErrors } from "./business-profile-form.types";

type BusinessProductEditorProps = {
  readonly errors: BusinessFormErrors;
  readonly products: readonly BusinessProductForm[];
  readonly categories: ReferenceData["categories"];
  readonly onChange: (products: readonly BusinessProductForm[]) => void;
};

export function BusinessProductEditor({
  categories,
  errors,
  onChange,
  products,
}: BusinessProductEditorProps) {
  function addProduct(): void {
    onChange([...products, createInitialBusinessProduct(`product-${crypto.randomUUID()}`)]);
  }

  function removeProduct(index: number): void {
    if (products.length === 1) {
      return;
    }
    onChange(products.filter((_, productIndex) => productIndex !== index));
  }

  function updateProduct(index: number, patch: Partial<BusinessProductForm>): void {
    onChange(
      products.map((product, productIndex) =>
        productIndex === index ? { ...product, ...patch } : product,
      ),
    );
  }

  return (
    <div className="grid gap-12">
      {products.map((product, index) => (
        <div
          className="grid gap-16 rounded-cards border border-soft-mist p-16 sm:p-20"
          key={product.key}
        >
          <div className="flex items-center justify-between gap-8">
            <p className="text-body font-w540 text-ink-charcoal">
              Produk {index + 1}
            </p>
            <Button
              aria-label={`Hapus produk ${index + 1}`}
              className="px-4"
              disabled={products.length === 1}
              onClick={() => removeProduct(index)}
              type="button"
              variant="ghost"
            >
              Hapus
            </Button>
          </div>
          <div className="grid gap-16 sm:grid-cols-2 sm:items-start">
            <Input
              error={errors[`products.${index}.name`]}
              id={`product-${product.key}-name`}
              label="Nama produk *"
              maxLength={180}
              onChange={(event) => updateProduct(index, { name: event.target.value })}
              placeholder="Kopi Susu"
              value={product.name}
            />
            <Input
              error={errors[`products.${index}.price`]}
              hint="Boleh dikosongkan."
              id={`product-${product.key}-price`}
              inputMode="numeric"
              label="Harga (Rupiah)"
              onChange={(event) => updateProduct(index, { price: digitsOnly(event.target.value) })}
              placeholder="25000"
              type="text"
              value={product.price}
            />
          </div>
          <Select
            error={errors[`products.${index}.categoryId`]}
            id={`product-${product.key}-category`}
            label="Kategori produk"
            onChange={(event) => updateProduct(index, { categoryId: event.target.value })}
            options={[
              { label: "Tanpa kategori", value: "" },
              ...categories.map(
                (category): SelectOption => ({ label: category.name, value: category.id }),
              ),
            ]}
            value={product.categoryId}
          />
        </div>
      ))}
      {products.length < 20 ? (
        <Button
          className="w-fit justify-self-start px-24"
          onClick={addProduct}
          type="button"
          variant="secondary"
        >
          Tambah produk
        </Button>
      ) : null}
      {errors.products ? (
        <p className="text-body-sm font-w540 text-midnight-wine">{errors.products}</p>
      ) : null}
    </div>
  );
}
