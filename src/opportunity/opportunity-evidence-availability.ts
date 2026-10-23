import type {
  OpportunityProfileContext,
  OpportunityProfileField,
} from "./opportunity-analysis-context";

export type OpportunityEvidenceStatus = "KNOWN" | "PARTIAL" | "UNKNOWN";

export type OpportunityFinancialMetric =
  | "PRODUCT_PRICE"
  | "AVERAGE_BUSINESS_PRICE"
  | "PROPOSED_PRODUCT_PRICE"
  | "COMPETITOR_PRICE"
  | "CUSTOMER_WILLINGNESS_TO_PAY"
  | "PRODUCTION_COST"
  | "OPERATING_COST"
  | "REVENUE"
  | "MARGIN"
  | "SALES_VOLUME"
  | "CUSTOMER_VALIDATION"
  | "BUDGET";

export type OpportunityEvidenceSubjectScope =
  | "BUSINESS"
  | "PRODUCT_SET"
  | "EXISTING_PRODUCT"
  | "PROPOSED_PRODUCT"
  | "COMPETITOR"
  | "CUSTOMER"
  | "BUSINESS_OPERATIONS";

export type OpportunityFinancialEvidenceEntry = Readonly<{
  id: string;
  metric: OpportunityFinancialMetric;
  subjectScope: OpportunityEvidenceSubjectScope;
  subjectId: string;
  status: OpportunityEvidenceStatus;
  trustedSourceReference: string;
  relatedProfileField?: OpportunityProfileField;
}>;

export type OpportunityEvidenceGapCode =
  | "EXISTING_PRODUCT_PRICE_UNKNOWN"
  | "PROPOSED_PRODUCT_PRICE_UNKNOWN"
  | "COMPETITOR_PRICE_UNKNOWN"
  | "CUSTOMER_WILLINGNESS_TO_PAY_UNKNOWN"
  | "COST_OF_GOODS_UNKNOWN"
  | "OPERATING_COST_UNKNOWN"
  | "REVENUE_HISTORY_UNKNOWN"
  | "MARGIN_UNKNOWN"
  | "SALES_VOLUME_UNKNOWN"
  | "CUSTOMER_VALIDATION_REQUIRED";

export type EligibleOpportunityEvidenceGap = Readonly<{
  id: string;
  code: OpportunityEvidenceGapCode;
  availabilityEntryId: string;
  metric: OpportunityFinancialMetric;
  subjectScope: OpportunityEvidenceSubjectScope;
  subjectId: string;
  trustedSourceReference: string;
}>;

export type OpportunityEvidenceAvailability = Readonly<{
  inventory: readonly OpportunityFinancialEvidenceEntry[];
  eligibleGaps: readonly EligibleOpportunityEvidenceGap[];
}>;

function entry(
  metric: OpportunityFinancialMetric,
  subjectScope: OpportunityEvidenceSubjectScope,
  subjectId: string,
  status: OpportunityEvidenceStatus,
  trustedSourceReference: string,
  relatedProfileField?: OpportunityProfileField,
): OpportunityFinancialEvidenceEntry {
  return {
    id: `availability_${metric.toLocaleLowerCase("en-US")}_${subjectId}`,
    metric,
    subjectScope,
    subjectId,
    status,
    trustedSourceReference,
    ...(relatedProfileField ? { relatedProfileField } : {}),
  };
}

function gap(
  value: OpportunityFinancialEvidenceEntry,
  code: OpportunityEvidenceGapCode,
): EligibleOpportunityEvidenceGap {
  return {
    id: `gap_${code.toLocaleLowerCase("en-US")}_${value.subjectId}`,
    code,
    availabilityEntryId: value.id,
    metric: value.metric,
    subjectScope: value.subjectScope,
    subjectId: value.subjectId,
    trustedSourceReference: value.trustedSourceReference,
  };
}

export function buildOpportunityEvidenceAvailability(
  profile: OpportunityProfileContext,
): OpportunityEvidenceAvailability {
  const inventory: OpportunityFinancialEvidenceEntry[] = [];
  const gaps: EligibleOpportunityEvidenceGap[] = [];

  if (profile.persona === "ENTREPRENEUR") {
    inventory.push(entry("BUDGET", "BUSINESS", "business", "KNOWN", "profile.budget", "profile.budget"));
  } else {
    const pricedCount = profile.products.filter((product) => product.price !== null).length;
    const productPriceStatus: OpportunityEvidenceStatus = pricedCount === 0
      ? "UNKNOWN"
      : pricedCount === profile.products.length
        ? "KNOWN"
        : "PARTIAL";
    inventory.push(entry(
      "PRODUCT_PRICE",
      "PRODUCT_SET",
      "profile.products",
      productPriceStatus,
      "profile.products[].price",
      "profile.products[].price",
    ));
    inventory.push(entry(
      "AVERAGE_BUSINESS_PRICE",
      "BUSINESS",
      "business",
      "KNOWN",
      "profile.averagePrice",
      "profile.averagePrice",
    ));

    profile.products.forEach((product, index) => {
      const subjectId = `profile.products[${index}]`;
      const knownPrice = product.price !== null;
      const productEntry = entry(
        "PRODUCT_PRICE",
        "EXISTING_PRODUCT",
        subjectId,
        knownPrice ? "KNOWN" : "UNKNOWN",
        `profile.products[${index}].price`,
        "profile.products[].price",
      );
      inventory.push(productEntry);
      if (!knownPrice) gaps.push(gap(productEntry, "EXISTING_PRODUCT_PRICE_UNKNOWN"));
    });
  }

  const unknownScopes: readonly Readonly<{
    metric: OpportunityFinancialMetric;
    subjectScope: OpportunityEvidenceSubjectScope;
    subjectId: string;
    code: OpportunityEvidenceGapCode;
  }>[] = [
    { metric: "PROPOSED_PRODUCT_PRICE", subjectScope: "PROPOSED_PRODUCT", subjectId: "proposal", code: "PROPOSED_PRODUCT_PRICE_UNKNOWN" },
    { metric: "COMPETITOR_PRICE", subjectScope: "COMPETITOR", subjectId: "market", code: "COMPETITOR_PRICE_UNKNOWN" },
    { metric: "CUSTOMER_WILLINGNESS_TO_PAY", subjectScope: "CUSTOMER", subjectId: "target_customer", code: "CUSTOMER_WILLINGNESS_TO_PAY_UNKNOWN" },
    { metric: "PRODUCTION_COST", subjectScope: "PRODUCT_SET", subjectId: "business_products", code: "COST_OF_GOODS_UNKNOWN" },
    { metric: "OPERATING_COST", subjectScope: "BUSINESS_OPERATIONS", subjectId: "business", code: "OPERATING_COST_UNKNOWN" },
    { metric: "REVENUE", subjectScope: "BUSINESS", subjectId: "business_history", code: "REVENUE_HISTORY_UNKNOWN" },
    { metric: "MARGIN", subjectScope: "BUSINESS", subjectId: "business", code: "MARGIN_UNKNOWN" },
    { metric: "SALES_VOLUME", subjectScope: "BUSINESS", subjectId: "business_history", code: "SALES_VOLUME_UNKNOWN" },
    { metric: "CUSTOMER_VALIDATION", subjectScope: "CUSTOMER", subjectId: "target_customer", code: "CUSTOMER_VALIDATION_REQUIRED" },
  ];

  for (const item of unknownScopes) {
    const value = entry(
      item.metric,
      item.subjectScope,
      item.subjectId,
      "UNKNOWN",
      "context.financialEvidenceAvailability",
    );
    inventory.push(value);
    gaps.push(gap(value, item.code));
  }

  return { inventory, eligibleGaps: gaps };
}

export function materializeOpportunityEvidenceGap(
  gapValue: EligibleOpportunityEvidenceGap,
  profile: OpportunityProfileContext,
  options: Readonly<{ includeSubjectName?: boolean }> = {},
): string {
  switch (gapValue.code) {
    case "EXISTING_PRODUCT_PRICE_UNKNOWN": {
      const index = Number(/^profile\.products\[(\d+)\]$/u.exec(gapValue.subjectId)?.[1]);
      const productName = options.includeSubjectName === false
        ? undefined
        : profile.persona === "UMKM_EXISTING" ? profile.products[index]?.name : undefined;
      return productName
        ? `Harga produk ${productName} belum dicantumkan dalam profil; lengkapi harga produk ini untuk analisis harga yang tepat.`
        : "Harga produk yang tercatat pada profil belum tersedia; lengkapi harga produk tersebut sebelum membandingkan harga.";
    }
    case "PROPOSED_PRODUCT_PRICE_UNKNOWN":
      return "Harga jual produk usulan belum ditentukan; validasi rentang harga yang diterima pelanggan sebelum meluncurkan.";
    case "COMPETITOR_PRICE_UNKNOWN":
      return "Harga produk pesaing belum tersedia dalam konteks tervalidasi; kumpulkan harga dari sumber yang dapat diperiksa.";
    case "CUSTOMER_WILLINGNESS_TO_PAY_UNKNOWN":
      return "Kesediaan pelanggan untuk membayar belum diverifikasi; uji melalui wawancara atau penawaran yang terukur.";
    case "COST_OF_GOODS_UNKNOWN":
      return "Biaya produksi produk belum tersedia; catat komponen biaya sebelum menilai margin.";
    case "OPERATING_COST_UNKNOWN":
      return "Biaya operasional belum tersedia dalam konteks ini; kumpulkan catatan biaya usaha yang relevan.";
    case "REVENUE_HISTORY_UNKNOWN":
      return "Riwayat pendapatan usaha belum tersedia dalam konteks ini; gunakan catatan usaha yang dapat diverifikasi.";
    case "MARGIN_UNKNOWN":
      return "Margin produk belum dapat dinilai tanpa data harga jual dan biaya yang sesuai.";
    case "SALES_VOLUME_UNKNOWN":
      return "Volume penjualan belum tersedia dalam konteks ini; kumpulkan catatan transaksi yang relevan.";
    case "CUSTOMER_VALIDATION_REQUIRED":
      return "Penerimaan pelanggan untuk hipotesis ini masih perlu divalidasi sebelum keputusan peluncuran.";
  }
}
