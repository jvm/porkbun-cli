/**
 * DomainDetailScreen - domain overview with tabs for DNS, nameservers, glue, forwards, DNSSEC, SSL, transfer.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Box, useInput } from "ink";
import { Text } from "../text.js";
import type { Theme } from "../theme.js";
import type { TuiApiService } from "../services/api.js";
import type {
  NormalizedDomain,
  NormalizedDnsRecord,
  NormalizedGlueRecord,
  NormalizedForward,
  NormalizedDnssecRecord,
  ReviewSnapshot,
} from "../types.js";
import { LoadingState, ErrorState, EmptyState } from "../components/StatusComponents.js";
import { VirtualList } from "../components/VirtualList.js";
import { DnsRecordForm } from "../components/DnsRecordForm.js";
import { MutationConfirm } from "../components/MutationConfirm.js";
import { GlueTab } from "../components/GlueTab.js";
import { GlueRecordForm } from "../components/GlueRecordForm.js";
import { ForwardsTab } from "../components/ForwardsTab.js";
import { ForwardForm } from "../components/ForwardForm.js";
import { DnssecTab } from "../components/DnssecTab.js";
import { DnssecRecordForm } from "../components/DnssecRecordForm.js";
import { NameserverForm } from "../components/NameserverForm.js";
import { SslTab } from "../components/SslTab.js";
import { TransferTab } from "../components/TransferTab.js";
import { RenewForm } from "../components/RenewForm.js";
import { useMutation } from "../hooks/useMutation.js";

interface DomainDetailScreenProps {
  service: TuiApiService;
  theme: Theme;
  domain: string;
  onBack: () => void;
}

type DetailTab =
  "overview" | "dns" | "nameservers" | "glue" | "forwards" | "dnssec" | "ssl" | "transfer";

const TABS: DetailTab[] = [
  "overview",
  "dns",
  "nameservers",
  "glue",
  "forwards",
  "dnssec",
  "ssl",
  "transfer",
];

type DnsMode = "view" | "create" | "edit" | "delete" | "confirm";

export function DomainDetailScreen({ service, theme, domain, onBack }: DomainDetailScreenProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [domainData, setDomainData] = useState<NormalizedDomain | undefined>();
  const [dnsRecords, setDnsRecords] = useState<NormalizedDnsRecord[]>([]);
  const [nameservers, setNameservers] = useState<string[]>([]);
  const [glueRecords, setGlueRecords] = useState<NormalizedGlueRecord[]>([]);
  const [forwards, setForwards] = useState<NormalizedForward[]>([]);
  const [dnssecRecords, setDnssecRecords] = useState<NormalizedDnssecRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Glue mutation state
  const [glueMode, setGlueMode] = useState<"view" | "create" | "edit" | "delete" | "confirm">(
    "view",
  );
  const [selectedGlueRecord, setSelectedGlueRecord] = useState<NormalizedGlueRecord | undefined>();
  const [glueFormData, setGlueFormData] = useState<Record<string, unknown>>({});
  const [glueReviewSnapshot, setGlueReviewSnapshot] = useState<ReviewSnapshot | undefined>();

  // Forward mutation state
  const [forwardMode, setForwardMode] = useState<"view" | "create" | "delete" | "confirm">("view");
  const [selectedForward, setSelectedForward] = useState<NormalizedForward | undefined>();
  const [forwardFormData, setForwardFormData] = useState<Record<string, unknown>>({});
  const [forwardReviewSnapshot, setForwardReviewSnapshot] = useState<ReviewSnapshot | undefined>();

  // DNSSEC mutation state
  const [dnssecMode, setDnssecMode] = useState<"view" | "create" | "delete" | "confirm">("view");
  const [selectedDnssecRecord, setSelectedDnssecRecord] = useState<
    NormalizedDnssecRecord | undefined
  >();
  const [dnssecFormData, setDnssecFormData] = useState<Record<string, unknown>>({});
  const [dnssecReviewSnapshot, setDnssecReviewSnapshot] = useState<ReviewSnapshot | undefined>();

  // Nameserver mutation state
  const [nameserverMode, setNameserverMode] = useState<"view" | "edit" | "confirm">("view");
  const [nameserverFormData, setNameserverFormData] = useState<string[]>([]);
  const [nameserverReviewSnapshot, setNameserverReviewSnapshot] = useState<
    ReviewSnapshot | undefined
  >();

  // DNS mutation state
  const [dnsMode, setDnsMode] = useState<DnsMode>("view");
  const [selectedDnsRecord, setSelectedDnsRecord] = useState<NormalizedDnsRecord | undefined>();
  const [dnsFormData, setDnsFormData] = useState<Record<string, unknown>>({});
  const [dnsReviewSnapshot, setDnsReviewSnapshot] = useState<ReviewSnapshot | undefined>();

  // Renewal mutation state
  const [renewMode, setRenewMode] = useState<"idle" | "form" | "submitting" | "success" | "error">(
    "idle",
  );
  const [renewError, setRenewError] = useState<string | undefined>();
  const [renewSuccess, setRenewSuccess] = useState<string | undefined>();

  // Centralized mutation runner. Wraps every service call so the screen
  // never has to write `try { await service.foo() } catch {}` (which would
  // never see the API error since the service catches it and returns a
  // ResourceState with status: 'error').
  const mutation = useMutation({
    onSuccess: (message) => setStatus({ type: "success", message }),
    onError: (message) => setStatus({ type: "error", message }),
  });

  // Load domain overview
  const loadDomain = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const result = await service.getDomain(domain);
    setLoading(false);
    if (result.status === "loaded" && result.data) {
      setDomainData(result.data);
    } else if (result.error) {
      setError(result.error);
    }
  }, [service, domain]);

  // Load DNS records
  const loadDns = useCallback(async () => {
    const result = await service.getDnsRecords(domain);
    if (result.status === "loaded" && result.data) {
      setDnsRecords(result.data);
    }
  }, [service, domain]);

  // Load nameservers
  const loadNameservers = useCallback(async () => {
    const result = await service.getNameservers(domain);
    if (result.status === "loaded" && result.data) {
      setNameservers(result.data);
    }
  }, [service, domain]);

  // Load glue records
  const loadGlue = useCallback(async () => {
    const result = await service.getGlueRecords(domain);
    if (result.status === "loaded" && result.data) {
      setGlueRecords(result.data);
    }
  }, [service, domain]);

  // Load forwards
  const loadForwards = useCallback(async () => {
    const result = await service.getUrlForwards(domain);
    if (result.status === "loaded" && result.data) {
      setForwards(result.data);
    }
  }, [service, domain]);

  // Load DNSSEC records
  const loadDnssec = useCallback(async () => {
    const result = await service.getDnssecRecords(domain);
    if (result.status === "loaded" && result.data) {
      setDnssecRecords(result.data);
    }
  }, [service, domain]);

  useEffect(() => {
    loadDomain();
  }, [loadDomain]);

  useEffect(() => {
    if (activeTab === "dns") loadDns();
    if (activeTab === "nameservers") loadNameservers();
    if (activeTab === "glue") loadGlue();
    if (activeTab === "forwards") loadForwards();
    if (activeTab === "dnssec") loadDnssec();
  }, [activeTab, loadDns, loadNameservers, loadGlue, loadForwards, loadDnssec]);

  // Suppress global shortcuts whenever any child form or confirmation is mounted.
  // Otherwise typing 'l' or 'h' in a hostname would silently switch tabs, 'q'
  // would exit the screen, and 'r' would reload data, discarding the form.
  const formActive =
    renewMode !== "idle" ||
    dnsMode !== "view" ||
    nameserverMode !== "view" ||
    glueMode !== "view" ||
    forwardMode !== "view" ||
    dnssecMode !== "view";

  // Handle input
  useInput((char, key) => {
    if (formActive) {
      if (key.escape && renewMode !== "idle") {
        setRenewMode("idle");
        setRenewError(undefined);
        setRenewSuccess(undefined);
      }
      return;
    }

    if (key.escape || char === "q") {
      onBack();
    } else if (char === "r") {
      loadDomain();
      if (activeTab === "dns") loadDns();
      if (activeTab === "nameservers") loadNameservers();
      if (activeTab === "glue") loadGlue();
      if (activeTab === "forwards") loadForwards();
      if (activeTab === "dnssec") loadDnssec();
    } else if (char === "R" && activeTab === "overview") {
      // Renew domain
      setRenewMode("form");
    } else if (key.leftArrow || char === "h") {
      const idx = TABS.indexOf(activeTab);
      if (idx > 0) setActiveTab(TABS.at(idx - 1)!);
    } else if (key.rightArrow || char === "l") {
      const idx = TABS.indexOf(activeTab);
      if (idx < TABS.length - 1) setActiveTab(TABS.at(idx + 1)!);
    }
  });

  if (loading && !domainData) {
    return <LoadingState message={`Loading ${domain}...`} theme={theme} />;
  }

  if (error) {
    return <ErrorState error={error} retryable onRetry={loadDomain} theme={theme} />;
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          {domain}
        </Text>
        {domainData && (
          <Text dimColor>
            {" "}
            | Status: {domainData.status} | Expires: {domainData.expireDate?.split("T")[0]}
          </Text>
        )}
      </Box>

      {/* Tabs */}
      <Box marginBottom={1}>
        {TABS.map((tab) => (
          <Box key={tab} marginRight={1}>
            <Text
              bold={tab === activeTab}
              color={tab === activeTab ? theme.colors.primary : undefined}
              backgroundColor={tab === activeTab ? theme.colors.selectedBg : undefined}
            >
              {" "}
              {tab}{" "}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Tab content */}
      <Box flexDirection="column" flexGrow={1}>
        {activeTab === "overview" && domainData && renewMode === "idle" && (
          <OverviewTab domain={domainData} theme={theme} />
        )}
        {activeTab === "overview" && domainData && renewMode !== "idle" && (
          <RenewForm
            theme={theme}
            service={service}
            domain={domainData}
            onRenew={async (domainName, cost) => {
              setRenewMode("submitting");
              setRenewError(undefined);
              setRenewSuccess(undefined);
              try {
                const result = await service.renewDomain(domainName, cost);
                if (result.status === "loaded") {
                  setRenewSuccess(`Successfully renewed ${domainName}!`);
                  setRenewMode("success");
                  // Reload domain to get updated expiration
                  await loadDomain();
                } else if (result.error) {
                  setRenewError(result.error.message);
                  setRenewMode("error");
                }
              } catch (err) {
                setRenewError(err instanceof Error ? err.message : String(err));
                setRenewMode("error");
              }
            }}
            onCancel={() => {
              setRenewMode("idle");
              setRenewError(undefined);
              setRenewSuccess(undefined);
            }}
          />
        )}
        {renewError && (
          <Box marginTop={1}>
            <Text color={theme.colors.danger}>✗ {renewError}</Text>
          </Box>
        )}
        {renewSuccess && (
          <Box marginTop={1}>
            <Text color={theme.colors.success}>✓ {renewSuccess}</Text>
          </Box>
        )}
        {activeTab === "dns" && dnsMode === "view" && (
          <DnsTab
            records={dnsRecords}
            theme={theme}
            onCreate={() => setDnsMode("create")}
            onEdit={(record) => {
              setSelectedDnsRecord(record);
              setDnsFormData({
                type: record.type,
                name: record.name,
                content: record.content,
                ttl: record.ttl,
                prio: record.prio,
              });
              setDnsMode("edit");
            }}
            onDelete={(record) => {
              setSelectedDnsRecord(record);
              setDnsMode("delete");
            }}
          />
        )}
        {activeTab === "dns" && (dnsMode === "create" || dnsMode === "edit") && (
          <DnsRecordForm
            theme={theme}
            domain={domain}
            mode={dnsMode}
            initialRecord={selectedDnsRecord}
            onSubmit={(formData) => {
              setDnsFormData(formData);
              const operationName = dnsMode === "create" ? "Create DNS Record" : "Edit DNS Record";
              const details = Object.entries(formData).map(([key, value]) => ({
                label: key,
                value: String(value ?? ""),
              }));
              setDnsReviewSnapshot({
                operation: operationName,
                target: domain,
                classification: "mutating",
                fields: details,
              });
              setDnsMode("confirm");
            }}
            onCancel={() => {
              setDnsMode("view");
              setSelectedDnsRecord(undefined);
              setDnsFormData({});
              setStatus(null);
            }}
          />
        )}
        {activeTab === "dns" && dnsMode === "delete" && selectedDnsRecord && (
          <MutationConfirm
            theme={theme}
            review={{
              operation: "Delete DNS Record",
              target: domain,
              classification: "destructive",
              fields: [
                { label: "Record ID", value: selectedDnsRecord.id },
                { label: "Type", value: selectedDnsRecord.type },
                { label: "Name", value: selectedDnsRecord.name },
                { label: "Content", value: selectedDnsRecord.content },
              ],
            }}
            confirmationLevel="disruptive"
            onConfirm={async () => {
              const recordId = selectedDnsRecord.id;
              const result = await mutation.run(
                () => service.deleteDnsRecord(domain, recordId),
                `Deleted DNS record ${recordId}`,
              );
              if (result?.status === "loaded") {
                setDnsMode("view");
                setSelectedDnsRecord(undefined);
                await loadDns();
              }
            }}
            onBack={() => {
              setDnsMode("view");
              setSelectedDnsRecord(undefined);
            }}
            onCancel={() => {
              setDnsMode("view");
              setSelectedDnsRecord(undefined);
            }}
            submitting={mutation.submitting}
          />
        )}
        {activeTab === "dns" && dnsMode === "confirm" && dnsReviewSnapshot && (
          <MutationConfirm
            theme={theme}
            review={dnsReviewSnapshot}
            confirmationLevel={
              dnsReviewSnapshot.classification === "destructive" ? "disruptive" : "standard"
            }
            onConfirm={async () => {
              const editing = !!selectedDnsRecord;
              const result = await mutation.run(
                () =>
                  editing
                    ? service.editDnsRecord(domain, selectedDnsRecord!.id, dnsFormData)
                    : service.createDnsRecord(domain, dnsFormData),
                editing ? `Edited DNS record ${selectedDnsRecord!.id}` : "Created DNS record",
              );
              if (result?.status === "loaded") {
                setDnsMode("view");
                setSelectedDnsRecord(undefined);
                setDnsFormData({});
                await loadDns();
              }
            }}
            onBack={() => {
              setDnsMode(selectedDnsRecord ? "edit" : "create");
            }}
            onCancel={() => {
              setDnsMode("view");
              setSelectedDnsRecord(undefined);
              setDnsFormData({});
            }}
            submitting={mutation.submitting}
          />
        )}
        {activeTab === "nameservers" && nameserverMode === "view" && (
          <NameserversTab
            nameservers={nameservers}
            theme={theme}
            onEdit={() => {
              setNameserverFormData([...nameservers]);
              setNameserverMode("edit");
            }}
          />
        )}
        {activeTab === "nameservers" && nameserverMode === "edit" && (
          <NameserverForm
            theme={theme}
            initialNameservers={nameserverFormData}
            onSubmit={(newNameservers) => {
              setNameserverFormData(newNameservers);
              setNameserverReviewSnapshot({
                operation: "Update Nameservers",
                target: domain,
                classification: "destructive",
                fields: [
                  { label: "Current", value: nameservers.join(", ") },
                  { label: "New", value: newNameservers.join(", ") },
                ],
              });
              setNameserverMode("confirm");
            }}
            onCancel={() => {
              setNameserverMode("view");
              setNameserverFormData([]);
              setStatus(null);
            }}
          />
        )}
        {activeTab === "nameservers" &&
          nameserverMode === "confirm" &&
          nameserverReviewSnapshot && (
            <MutationConfirm
              theme={theme}
              review={nameserverReviewSnapshot}
              confirmationLevel="disruptive"
              onConfirm={async () => {
                const result = await mutation.run(
                  () => service.updateNameservers(domain, nameserverFormData),
                  "Nameservers updated successfully",
                );
                if (result?.status === "loaded") {
                  setNameserverMode("view");
                  setNameserverFormData([]);
                  setNameserverReviewSnapshot(undefined);
                  await loadNameservers();
                }
              }}
              onBack={() => {
                setNameserverMode("edit");
                setNameserverReviewSnapshot(undefined);
              }}
              onCancel={() => {
                setNameserverMode("view");
                setNameserverFormData([]);
                setNameserverReviewSnapshot(undefined);
              }}
              submitting={mutation.submitting}
            />
          )}
        {activeTab === "glue" && glueMode === "view" && (
          <GlueTab
            records={glueRecords}
            theme={theme}
            onCreate={() => setGlueMode("create")}
            onEdit={(record) => {
              setSelectedGlueRecord(record);
              setGlueFormData({
                hostname: record.hostname,
                ips: record.ips,
              });
              setGlueMode("edit");
            }}
            onDelete={(record) => {
              setSelectedGlueRecord(record);
              setGlueReviewSnapshot({
                operation: "Delete Glue Record",
                target: domain,
                classification: "destructive",
                fields: [
                  { label: "Hostname", value: record.hostname },
                  { label: "IP Addresses", value: record.ips.join(", ") },
                ],
              });
              setGlueMode("delete");
            }}
          />
        )}
        {activeTab === "glue" && (glueMode === "create" || glueMode === "edit") && (
          <GlueRecordForm
            theme={theme}
            mode={glueMode}
            initialRecord={selectedGlueRecord}
            initialValues={
              glueFormData.hostname || glueFormData.ips
                ? {
                    hostname: glueFormData.hostname as string | undefined,
                    ips: glueFormData.ips as string[] | undefined,
                  }
                : undefined
            }
            onSubmit={(formData) => {
              setGlueFormData(formData as Record<string, unknown>);
              const isEdit = glueMode === "edit" && !!selectedGlueRecord;
              setGlueReviewSnapshot({
                operation: isEdit ? "Update Glue Record" : "Create Glue Record",
                target: domain,
                classification: "mutating",
                fields: [
                  { label: "Hostname", value: formData.hostname },
                  { label: "IP Addresses", value: formData.ips.join(", ") },
                ],
              });
              setGlueMode("confirm");
            }}
            onCancel={() => {
              setGlueMode("view");
              setGlueFormData({});
              setSelectedGlueRecord(undefined);
            }}
          />
        )}
        {activeTab === "glue" && glueMode === "confirm" && glueReviewSnapshot && (
          <MutationConfirm
            theme={theme}
            review={glueReviewSnapshot}
            confirmationLevel="standard"
            onConfirm={async () => {
              const isEdit = !!selectedGlueRecord;
              const ips = (glueFormData.ips as string[]) ?? [];
              const result = await mutation.run(
                () =>
                  isEdit
                    ? service.updateGlueRecord(domain, selectedGlueRecord!.subdomain, ips)
                    : service.createGlueRecord(domain, glueFormData.hostname as string, ips),
                isEdit ? "Glue record updated" : "Glue record created",
              );
              if (result?.status === "loaded") {
                await loadGlue();
                setGlueMode("view");
                setGlueFormData({});
                setGlueReviewSnapshot(undefined);
                setSelectedGlueRecord(undefined);
              }
            }}
            onBack={() => {
              setGlueReviewSnapshot(undefined);
              setGlueMode(selectedGlueRecord ? "edit" : "create");
            }}
            onCancel={() => {
              setGlueMode("view");
              setGlueFormData({});
              setGlueReviewSnapshot(undefined);
              setSelectedGlueRecord(undefined);
            }}
            submitting={mutation.submitting}
          />
        )}
        {activeTab === "glue" && glueMode === "delete" && glueReviewSnapshot && (
          <MutationConfirm
            theme={theme}
            review={glueReviewSnapshot}
            confirmationLevel="disruptive"
            onConfirm={async () => {
              const subdomain = selectedGlueRecord!.subdomain;
              const result = await mutation.run(
                () => service.deleteGlueRecord(domain, subdomain),
                "Glue record deleted",
              );
              if (result?.status === "loaded") {
                await loadGlue();
                setGlueMode("view");
                setGlueReviewSnapshot(undefined);
                setSelectedGlueRecord(undefined);
              }
            }}
            onBack={() => {
              setGlueMode("view");
              setGlueReviewSnapshot(undefined);
              setSelectedGlueRecord(undefined);
            }}
            onCancel={() => {
              setGlueMode("view");
              setGlueReviewSnapshot(undefined);
              setSelectedGlueRecord(undefined);
            }}
            submitting={mutation.submitting}
          />
        )}
        {activeTab === "forwards" && forwardMode === "view" && (
          <ForwardsTab
            forwards={forwards}
            theme={theme}
            onCreate={() => setForwardMode("create")}
            onDelete={(forward) => {
              setSelectedForward(forward);
              setForwardReviewSnapshot({
                operation: "Delete URL Forward",
                target: domain,
                classification: "destructive",
                fields: [
                  { label: "Subdomain", value: forward.subdomain || "(root)" },
                  { label: "Location", value: forward.location },
                  { label: "Type", value: forward.type },
                ],
              });
              setForwardMode("delete");
            }}
          />
        )}
        {activeTab === "forwards" && forwardMode === "create" && (
          <ForwardForm
            theme={theme}
            initialValues={
              Object.keys(forwardFormData).length > 0
                ? {
                    subdomain: forwardFormData.subdomain as string | undefined,
                    location: forwardFormData.location as string | undefined,
                    type: forwardFormData.type as string | undefined,
                    includePath: forwardFormData.includePath as string | undefined,
                    wildcard: forwardFormData.wildcard as string | undefined,
                  }
                : undefined
            }
            onSubmit={(formData) => {
              setForwardFormData(formData as Record<string, unknown>);
              setForwardReviewSnapshot({
                operation: "Create URL Forward",
                target: domain,
                classification: "mutating",
                fields: [
                  { label: "Subdomain", value: formData.subdomain || "(root)" },
                  { label: "Location", value: formData.location },
                  { label: "Type", value: formData.type },
                  { label: "Include Path", value: formData.includePath },
                  { label: "Wildcard", value: formData.wildcard },
                ],
              });
              setForwardMode("confirm");
            }}
            onCancel={() => setForwardMode("view")}
          />
        )}
        {activeTab === "forwards" && forwardMode === "confirm" && forwardReviewSnapshot && (
          <MutationConfirm
            theme={theme}
            review={forwardReviewSnapshot}
            confirmationLevel="standard"
            onConfirm={async () => {
              const result = await mutation.run(
                () => service.addUrlForward(domain, forwardFormData),
                "URL forward created",
              );
              if (result?.status === "loaded") {
                await loadForwards();
                setForwardMode("view");
                setForwardFormData({});
                setForwardReviewSnapshot(undefined);
              }
            }}
            onBack={() => {
              setForwardReviewSnapshot(undefined);
              setForwardMode("create");
            }}
            onCancel={() => {
              setForwardMode("view");
              setForwardFormData({});
              setForwardReviewSnapshot(undefined);
            }}
            submitting={mutation.submitting}
          />
        )}
        {activeTab === "forwards" && forwardMode === "delete" && forwardReviewSnapshot && (
          <MutationConfirm
            theme={theme}
            review={forwardReviewSnapshot}
            confirmationLevel="disruptive"
            onConfirm={async () => {
              const id = selectedForward!.id;
              const result = await mutation.run(
                () => service.deleteUrlForward(domain, id),
                "URL forward deleted",
              );
              if (result?.status === "loaded") {
                await loadForwards();
                setForwardMode("view");
                setForwardReviewSnapshot(undefined);
                setSelectedForward(undefined);
              }
            }}
            onBack={() => {
              setForwardMode("view");
              setForwardReviewSnapshot(undefined);
              setSelectedForward(undefined);
            }}
            onCancel={() => {
              setForwardMode("view");
              setForwardReviewSnapshot(undefined);
              setSelectedForward(undefined);
            }}
            submitting={mutation.submitting}
          />
        )}
        {activeTab === "dnssec" && dnssecMode === "view" && (
          <DnssecTab
            records={dnssecRecords}
            theme={theme}
            onCreate={() => setDnssecMode("create")}
            onDelete={(record) => {
              setSelectedDnssecRecord(record);
              setDnssecReviewSnapshot({
                operation: "Delete DNSSEC Record",
                target: domain,
                classification: "destructive",
                fields: [
                  { label: "Key Tag", value: String(record.keyTag) },
                  { label: "Algorithm", value: String(record.alg) },
                  { label: "Digest Type", value: String(record.digestType) },
                ],
              });
              setDnssecMode("delete");
            }}
          />
        )}
        {activeTab === "dnssec" && dnssecMode === "create" && (
          <DnssecRecordForm
            theme={theme}
            initialValues={
              Object.keys(dnssecFormData).length > 0
                ? {
                    keyTag: String(dnssecFormData.keyTag ?? ""),
                    alg: String(dnssecFormData.alg ?? ""),
                    digestType: String(dnssecFormData.digestType ?? ""),
                    digest: String(dnssecFormData.digest ?? ""),
                  }
                : undefined
            }
            onSubmit={(formData) => {
              setDnssecFormData(formData as Record<string, unknown>);
              setDnssecReviewSnapshot({
                operation: "Create DNSSEC Record",
                target: domain,
                classification: "mutating",
                fields: [
                  { label: "Key Tag", value: String(formData.keyTag ?? "") },
                  { label: "Algorithm", value: String(formData.alg ?? "") },
                  { label: "Digest Type", value: String(formData.digestType ?? "") },
                  { label: "Digest", value: String(formData.digest ?? "") },
                ],
              });
              setDnssecMode("confirm");
            }}
            onCancel={() => setDnssecMode("view")}
          />
        )}
        {activeTab === "dnssec" && dnssecMode === "confirm" && dnssecReviewSnapshot && (
          <MutationConfirm
            theme={theme}
            review={dnssecReviewSnapshot}
            confirmationLevel="standard"
            onConfirm={async () => {
              const result = await mutation.run(
                () => service.createDnssecRecord(domain, dnssecFormData),
                "DNSSEC record created",
              );
              if (result?.status === "loaded") {
                await loadDnssec();
                setDnssecMode("view");
                setDnssecFormData({});
                setDnssecReviewSnapshot(undefined);
              }
            }}
            onBack={() => {
              setDnssecReviewSnapshot(undefined);
              setDnssecMode("create");
            }}
            onCancel={() => {
              setDnssecMode("view");
              setDnssecFormData({});
              setDnssecReviewSnapshot(undefined);
            }}
            submitting={mutation.submitting}
          />
        )}
        {activeTab === "dnssec" && dnssecMode === "delete" && dnssecReviewSnapshot && (
          <MutationConfirm
            theme={theme}
            review={dnssecReviewSnapshot}
            confirmationLevel="disruptive"
            onConfirm={async () => {
              const keyTag = String(selectedDnssecRecord!.keyTag);
              const result = await mutation.run(
                () => service.deleteDnssecRecord(domain, keyTag),
                "DNSSEC record deleted",
              );
              if (result?.status === "loaded") {
                await loadDnssec();
                setDnssecMode("view");
                setDnssecReviewSnapshot(undefined);
                setSelectedDnssecRecord(undefined);
              }
            }}
            onBack={() => {
              setDnssecMode("view");
              setDnssecReviewSnapshot(undefined);
              setSelectedDnssecRecord(undefined);
            }}
            onCancel={() => {
              setDnssecMode("view");
              setDnssecReviewSnapshot(undefined);
              setSelectedDnssecRecord(undefined);
            }}
            submitting={mutation.submitting}
          />
        )}
        {activeTab === "ssl" && <SslTab domain={domain} service={service} theme={theme} />}
        {activeTab === "transfer" && (
          <TransferTab domain={domain} service={service} theme={theme} />
        )}
      </Box>

      {status && (
        <Box marginTop={1}>
          <Text color={status.type === "error" ? theme.colors.danger : theme.colors.success}>
            {status.type === "error" ? "Error: " : ""}
            {status.message}
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box>
        <Text dimColor>←/→ or h/l: Switch tabs | r: Refresh | Esc/q: Back</Text>
      </Box>
    </Box>
  );
}

function OverviewTab({ domain, theme }: { domain: NormalizedDomain; theme: Theme }) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>Status: </Text>
        <Text>{domain.status}</Text>
      </Box>
      <Box>
        <Text dimColor>TLD: </Text>
        <Text>{domain.tld}</Text>
      </Box>
      <Box>
        <Text dimColor>Created: </Text>
        <Text>{domain.createDate ?? "(unknown)"}</Text>
      </Box>
      <Box>
        <Text dimColor>Expires: </Text>
        <Text>{domain.expireDate ?? "(unknown)"}</Text>
      </Box>
      <Box>
        <Text dimColor>Security Lock: </Text>
        <Text>{domain.securityLock ? theme.icons.check : theme.icons.cross}</Text>
      </Box>
      <Box>
        <Text dimColor>WHOIS Privacy: </Text>
        <Text>{domain.whoisPrivacy ? theme.icons.check : theme.icons.cross}</Text>
      </Box>
      <Box>
        <Text dimColor>Auto-renew: </Text>
        <Text color={domain.autoRenew ? theme.colors.success : theme.colors.danger}>
          {domain.autoRenew ? theme.icons.check : theme.icons.cross}
        </Text>
      </Box>
      <Box>
        <Text dimColor>API Access: </Text>
        <Text color={domain.apiAccess ? theme.colors.success : theme.colors.warning}>
          {domain.apiAccess ? theme.icons.check : theme.icons.cross}
        </Text>
      </Box>
      {domain.labels && domain.labels.length > 0 && (
        <Box>
          <Text dimColor>Labels: </Text>
          <Text>{domain.labels.join(", ")}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {theme.icons.web} Web-only features (not available in Porkbun API v3): domain contacts,
          registrar lock/unlock, transfer-out auth, WHOIS privacy mode, labels editing, API access
          toggles, parking, pushes, hosting, marketplace, deletion.
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press 'R' to renew this domain</Text>
      </Box>
    </Box>
  );
}

function DnsTab({
  records,
  theme,
  onCreate,
  onEdit,
  onDelete,
}: {
  records: NormalizedDnsRecord[];
  theme: Theme;
  onCreate?: () => void;
  onEdit?: (record: NormalizedDnsRecord) => void;
  onDelete?: (record: NormalizedDnsRecord) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((prev) => Math.max(0, Math.min(records.length - 1, prev + 1)));
    } else if (input === "c" && onCreate) {
      onCreate();
    } else if (input === "e" && onEdit && records.at(selectedIndex)) {
      onEdit(records.at(selectedIndex)!);
    } else if (input === "d" && onDelete && records.at(selectedIndex)) {
      onDelete(records.at(selectedIndex)!);
    }
  });

  if (records.length === 0) {
    return (
      <Box flexDirection="column">
        <EmptyState message="No DNS records found." theme={theme} />
        {onCreate && (
          <Box marginTop={1}>
            <Text dimColor>Press 'c' to create a new DNS record</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <VirtualList
        items={records}
        selectedIndex={selectedIndex}
        maxVisible={15}
        theme={theme}
        renderItem={(record, index, isSelected) => (
          <Box>
            <Text
              backgroundColor={isSelected ? theme.colors.selectedBg : undefined}
              color={isSelected ? theme.colors.selected : undefined}
            >
              {isSelected ? theme.icons.selected : theme.icons.unselected} {record.type.padEnd(6)}
              {record.name.padEnd(25)}
              {record.content.slice(0, 40).padEnd(40)}
              TTL:{record.ttl ?? "?"}
              {record.prio !== undefined && ` P:${record.prio}`}
            </Text>
          </Box>
        )}
      />
      <Box marginTop={1}>
        <Text dimColor>↑↓/jk: Navigate | c: Create | e: Edit | d: Delete</Text>
      </Box>
    </Box>
  );
}

function NameserversTab({
  nameservers,
  theme,
  onEdit,
}: {
  nameservers: string[];
  theme: Theme;
  onEdit?: () => void;
}) {
  useInput((input) => {
    if (input === "e" && onEdit) {
      onEdit();
    }
  });

  if (nameservers.length === 0) {
    return (
      <Box flexDirection="column">
        <EmptyState message="No nameservers found." theme={theme} />
        {onEdit && (
          <Box marginTop={1}>
            <Text dimColor>Press 'e' to configure nameservers</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Nameservers:</Text>
      {nameservers.map((ns, i) => (
        <Box key={i}>
          <Text>
            {i + 1}. {ns}
          </Text>
        </Box>
      ))}
      {onEdit && (
        <Box marginTop={1}>
          <Text dimColor>Press 'e' to edit nameservers</Text>
        </Box>
      )}
    </Box>
  );
}
