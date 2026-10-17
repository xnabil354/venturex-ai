"use client";

import { useEffect, useState } from "react";

import { Select, type SelectOption } from "@/components/ui";
import {
  fetchIndonesiaRegions,
  type IndonesiaRegion,
} from "@/reference/indonesia-regions";

type RegionFieldValues = {
  readonly province: string;
  readonly provinceId: string;
  readonly city: string;
  readonly cityId: string;
  readonly district: string;
  readonly districtId: string;
  readonly subdistrict: string;
  readonly subdistrictId: string;
};

type RegionFieldPatch = Partial<RegionFieldValues>;
type RegionFieldErrors = Readonly<Record<string, string>>;
type LoadStatus = "idle" | "loading" | "loaded" | "error";
type RetryCounts = {
  readonly provinces: number;
  readonly regencies: number;
  readonly districts: number;
  readonly villages: number;
};

type IndonesiaRegionFieldsProps = {
  readonly errors: RegionFieldErrors;
  readonly required?: boolean;
  readonly values: RegionFieldValues;
  readonly onChange: (patch: RegionFieldPatch) => void;
};

function normalizeRegionName(name: string): string {
  const normalized = name.trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
  const jakartaAlias = /^(dki|daerah khusus(?: ibu kota)?) jakarta$/;
  if (jakartaAlias.test(normalized)) {
    return "jakarta";
  }

  return normalized.replace(
    /^(kota administrasi|kabupaten administrasi|kota|kabupaten)\s+/,
    "",
  );
}

function findRegionByName(
  regions: readonly IndonesiaRegion[],
  name: string,
): IndonesiaRegion | undefined {
  const normalizedName = normalizeRegionName(name);
  if (!normalizedName) {
    return undefined;
  }

  const exactMatch = regions.find(
    (region) =>
      region.name.trim().toLocaleLowerCase("id-ID") ===
      name.trim().toLocaleLowerCase("id-ID"),
  );
  if (exactMatch) {
    return exactMatch;
  }

  const matches = regions.filter(
    (region) => normalizeRegionName(region.name) === normalizedName,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function toOptions(regions: readonly IndonesiaRegion[]): readonly SelectOption[] {
  return regions.map(({ id, name }) => ({ label: name, value: id }));
}

function getFieldHint(status: LoadStatus): string | undefined {
  if (status === "error") {
    return "Daftar wilayah gagal dimuat.";
  }
  return undefined;
}

function getSavedValueHint(
  status: LoadStatus,
  regions: readonly IndonesiaRegion[],
  value: string,
  label: string,
): string | undefined {
  if (status === "loaded" && value && !findRegionByName(regions, value)) {
    return `Wilayah tersimpan “${value}” tidak ditemukan. Pilih ${label} kembali.`;
  }
  return undefined;
}

function getPlaceholder(
  status: LoadStatus,
  label: string,
): string {
  if (status === "loading") {
    return "Memuat…";
  }
  if (status === "idle") {
    return "Pilih wilayah dulu";
  }
  if (status === "error") {
    return "Daftar belum tersedia";
  }
  return `Pilih ${label}`;
}

export function IndonesiaRegionFields({
  errors,
  onChange,
  required = true,
  values,
}: IndonesiaRegionFieldsProps) {
  const [provinces, setProvinces] = useState<readonly IndonesiaRegion[]>([]);
  const [regencies, setRegencies] = useState<readonly IndonesiaRegion[]>([]);
  const [districts, setDistricts] = useState<readonly IndonesiaRegion[]>([]);
  const [villages, setVillages] = useState<readonly IndonesiaRegion[]>([]);
  const [provinceStatus, setProvinceStatus] = useState<LoadStatus>("loading");
  const [regencyStatus, setRegencyStatus] = useState<LoadStatus>("idle");
  const [districtStatus, setDistrictStatus] = useState<LoadStatus>("idle");
  const [villageStatus, setVillageStatus] = useState<LoadStatus>("idle");
  const [retryCounts, setRetryCounts] = useState<RetryCounts>({
    provinces: 0,
    regencies: 0,
    districts: 0,
    villages: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    setProvinceStatus("loading");

    void fetchIndonesiaRegions({ level: "provinces" }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setProvinces(result);
          setProvinceStatus("loaded");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setProvinceStatus("error");
        }
      });

    return () => controller.abort();
  }, [retryCounts.provinces]);

  useEffect(() => {
    if (!values.provinceId) {
      setRegencies([]);
      setRegencyStatus("idle");
      return;
    }

    const controller = new AbortController();
    setRegencyStatus("loading");

    void fetchIndonesiaRegions(
      { level: "regencies", parentId: values.provinceId },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setRegencies(result);
          setRegencyStatus("loaded");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRegencyStatus("error");
        }
      });

    return () => controller.abort();
  }, [retryCounts.regencies, values.provinceId]);

  useEffect(() => {
    if (!values.cityId) {
      setDistricts([]);
      setDistrictStatus("idle");
      return;
    }

    const controller = new AbortController();
    setDistrictStatus("loading");

    void fetchIndonesiaRegions(
      { level: "districts", parentId: values.cityId },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setDistricts(result);
          setDistrictStatus("loaded");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDistrictStatus("error");
        }
      });

    return () => controller.abort();
  }, [retryCounts.districts, values.cityId]);

  useEffect(() => {
    if (!values.districtId) {
      setVillages([]);
      setVillageStatus("idle");
      return;
    }

    const controller = new AbortController();
    setVillageStatus("loading");

    void fetchIndonesiaRegions(
      { level: "villages", parentId: values.districtId },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setVillages(result);
          setVillageStatus("loaded");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setVillageStatus("error");
        }
      });

    return () => controller.abort();
  }, [retryCounts.villages, values.districtId]);

  useEffect(() => {
    if (provinceStatus !== "loaded" || values.provinceId || !values.province) {
      return;
    }
    const match = findRegionByName(provinces, values.province);
    if (match) {
      onChange({ provinceId: match.id, province: match.name });
    }
  }, [onChange, provinceStatus, provinces, values.province, values.provinceId]);

  useEffect(() => {
    if (regencyStatus !== "loaded" || values.cityId || !values.city) {
      return;
    }
    const match = findRegionByName(regencies, values.city);
    if (match) {
      onChange({ cityId: match.id, city: match.name });
    }
  }, [onChange, regencies, regencyStatus, values.city, values.cityId]);

  useEffect(() => {
    if (districtStatus !== "loaded" || values.districtId || !values.district) {
      return;
    }
    const match = findRegionByName(districts, values.district);
    if (match) {
      onChange({ districtId: match.id, district: match.name });
    }
  }, [districtStatus, districts, onChange, values.district, values.districtId]);

  useEffect(() => {
    if (villageStatus !== "loaded" || values.subdistrictId || !values.subdistrict) {
      return;
    }
    const match = findRegionByName(villages, values.subdistrict);
    if (match) {
      onChange({ subdistrictId: match.id, subdistrict: match.name });
    }
  }, [onChange, values.subdistrict, values.subdistrictId, villageStatus, villages]);

  function retry(level: keyof RetryCounts): void {
    setRetryCounts((current) => ({ ...current, [level]: current[level] + 1 }));
  }

  function renderRetryAction(
    status: LoadStatus,
    level: keyof RetryCounts,
    label: string,
  ) {
    return status === "error" ? (
      <button
        className="w-fit text-body-sm font-w540 text-royal-violet underline-offset-4 hover:underline focus-visible:rounded-small-buttons focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
        onClick={() => retry(level)}
        type="button"
      >
        Coba muat ulang {label}
      </button>
    ) : null;
  }

  const provinceOptions = toOptions(provinces);
  const regencyOptions = toOptions(regencies);
  const districtOptions = toOptions(districts);
  const villageOptions = toOptions(villages);

  return (
    <div className="grid gap-16 sm:grid-cols-2">
      <div className="grid gap-8">
        <Select
          aria-busy={provinceStatus === "loading"}
          disabled={provinceStatus !== "loaded" || provinces.length === 0}
          error={errors.province}
          hint={
            getFieldHint(provinceStatus) ??
            getSavedValueHint(provinceStatus, provinces, values.province, "provinsi")
          }
          id="location-province"
            label={`Provinsi${required ? " *" : ""}`}
          onChange={(event) => {
            const nextId = event.target.value;
            const selected = provinces.find(({ id }) => id === nextId);
            setRegencies([]);
            setDistricts([]);
            setVillages([]);
            setRegencyStatus(nextId ? "loading" : "idle");
            setDistrictStatus("idle");
            setVillageStatus("idle");
            onChange({
              provinceId: nextId,
              province: selected?.name ?? "",
              cityId: "",
              city: "",
              districtId: "",
              district: "",
              subdistrictId: "",
              subdistrict: "",
            });
          }}
            required={required}
          options={[
            { value: "", label: getPlaceholder(provinceStatus, "provinsi") },
            ...provinceOptions,
          ]}
          value={values.provinceId}
        />
        {renderRetryAction(provinceStatus, "provinces", "provinsi")}
      </div>

      <div className="grid gap-8">
        <Select
          aria-busy={regencyStatus === "loading"}
          disabled={regencyStatus !== "loaded" || regencies.length === 0}
          error={errors.city}
          hint={
            getFieldHint(regencyStatus) ??
            getSavedValueHint(regencyStatus, regencies, values.city, "kota/kabupaten")
          }
          id="location-city"
            label={`Kota/Kabupaten${required ? " *" : ""}`}
          onChange={(event) => {
            const nextId = event.target.value;
            const selected = regencies.find(({ id }) => id === nextId);
            setDistricts([]);
            setVillages([]);
            setDistrictStatus(nextId ? "loading" : "idle");
            setVillageStatus("idle");
            onChange({
              cityId: nextId,
              city: selected?.name ?? "",
              districtId: "",
              district: "",
              subdistrictId: "",
              subdistrict: "",
            });
          }}
            required={required}
          options={[
            { value: "", label: getPlaceholder(regencyStatus, "kota/kabupaten") },
            ...regencyOptions,
          ]}
          value={values.cityId}
        />
        {renderRetryAction(regencyStatus, "regencies", "kota/kabupaten")}
      </div>

      <div className="grid gap-8">
        <Select
          aria-busy={districtStatus === "loading"}
          disabled={districtStatus !== "loaded" || districts.length === 0}
          error={errors.district}
          hint={
            getFieldHint(districtStatus) ??
            getSavedValueHint(districtStatus, districts, values.district, "kecamatan")
          }
          id="location-district"
            label={`Kecamatan${required ? " *" : ""}`}
          onChange={(event) => {
            const nextId = event.target.value;
            const selected = districts.find(({ id }) => id === nextId);
            setVillages([]);
            setVillageStatus(nextId ? "loading" : "idle");
            onChange({
              districtId: nextId,
              district: selected?.name ?? "",
              subdistrictId: "",
              subdistrict: "",
            });
          }}
            required={required}
          options={[
            { value: "", label: getPlaceholder(districtStatus, "kecamatan") },
            ...districtOptions,
          ]}
          value={values.districtId}
        />
        {renderRetryAction(districtStatus, "districts", "kecamatan")}
      </div>

      <div className="grid gap-8">
        <Select
          aria-busy={villageStatus === "loading"}
          disabled={villageStatus !== "loaded" || villages.length === 0}
          error={errors.subdistrict}
          hint={
            getFieldHint(villageStatus) ??
            getSavedValueHint(villageStatus, villages, values.subdistrict, "kelurahan")
          }
          id="location-subdistrict"
            label={`Kelurahan${required ? " *" : ""}`}
          onChange={(event) => {
            const selected = villages.find(({ id }) => id === event.target.value);
            onChange({
              subdistrictId: event.target.value,
              subdistrict: selected?.name ?? "",
            });
          }}
            required={required}
          options={[
            { value: "", label: getPlaceholder(villageStatus, "kelurahan") },
            ...villageOptions,
          ]}
          value={values.subdistrictId}
        />
        {renderRetryAction(villageStatus, "villages", "kelurahan")}
      </div>
    </div>
  );
}
