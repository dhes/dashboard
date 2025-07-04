// Dashboard.tsx
import React from "react";
import type {
  Observation,
  Patient,
  Procedure,
  MedicationStatement,
  Condition,
  AllergyIntolerance,
  FamilyMemberHistory,
  Immunization,
} from "fhir/r4";
import { useEffect, useState } from "react";
// import { Card, CardContent } from "@/components/ui/card";
import { Card, CardContent } from "./components/ui/card";
import {
  Card as MuiCard,
  CardContent as MuiCardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";

import SmokingStatusForm from "./SmokingStatusForm";

const FHIR_SERVER = "http://localhost:8080/fhir"; // Replace with your actual URL

async function fetchFHIR<T>(resourceType: string, searchParams: string): Promise<T[]> {
  const res = await fetch(`${FHIR_SERVER}/${resourceType}?${searchParams}`);
  const bundle = await res.json();
  console.log(`Fetched ${resourceType}:`, bundle);
  return bundle.entry?.map((e: { resource: T }) => e.resource) || [];
}

function getDisplayText(concept?: { text?: string; coding?: { display?: string }[] }): string {
  return concept?.text ?? concept?.coding?.[0]?.display ?? "Unknown";
}

function getCodingDisplay(coding?: { display?: string }[]): string {
  return coding?.[0]?.display ?? "Unknown";
}

function formatQuantity(quantity?: { value?: number; unit?: string }): string {
  if (quantity?.value == null) return "—";
  return `${quantity.value} ${quantity.unit ?? ""}`.trim();
}

function groupObservationsByDate(observations: Observation[]): Record<string, Observation[]> {
  return observations.reduce((acc: Record<string, Observation[]>, obs) => {
    const date = obs.effectiveDateTime?.slice(0, 10) ?? "Unknown Date";
    if (!acc[date]) acc[date] = [];
    acc[date].push(obs);
    return acc;
  }, {});
}

function groupProceduresByDate(procedures: Procedure[]): Record<string, Procedure[]> {
  return procedures.reduce((acc: Record<string, Procedure[]>, p) => {
    const date = p.performedDateTime?.slice(0, 10) ?? "Unknown Date";
    if (!acc[date]) acc[date] = [];
    acc[date].push(p);
    return acc;
  }, {});
}

export default function Dashboard() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>("minimal-test");
  const [availablePatients, setAvailablePatients] = useState<Patient[]>([]);
  const [labs, setLabs] = useState<Observation[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [medications, setMedications] = useState<MedicationStatement[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [familyHistories, setFamilyHistories] = useState<FamilyMemberHistory[]>([]);
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);
  const [psaReminder, setPsaReminder] = useState<string | null>(null);
  const [measureReport, setMeasureReport] = useState<any | null>(null);
  const [showEncounterForm, setShowEncounterForm] = useState(false);
  const [encounterDate, setEncounterDate] = useState("");
  const [icd10, setIcd10] = useState("");
  const [cpt, setCpt] = useState("");
  const [showSmokingStatusPrompt, setShowSmokingStatusPrompt] = useState(false);
  const [latestSmokingObservation, setLatestSmokingObservation] = useState<Observation | null>(
    null
  );
  const [showSmokingForm, setShowSmokingForm] = useState(false);

  // Fetch available patients once
  useEffect(() => {
    fetchFHIR<Patient>("Patient", `_count=100`).then(setAvailablePatients);
  }, []);

  // Fetch patient-specific data when selectedPatientId changes
  useEffect(() => {
    if (!selectedPatientId) return;
    setShowSmokingStatusPrompt(false); // Clear smoking status prompt immediately when switching patients
    fetchFHIR<Patient>("Patient", `_id=${selectedPatientId}`).then((results) =>
      setPatient(results[0])
    );
    setPsaReminder(null); // Clear old reminder while fetching new one
    fetch(`${FHIR_SERVER}/PlanDefinition/psa-reminder/$apply?subject=Patient/${selectedPatientId}`)
      .then((res) => res.json())
      .then((carePlan) => {
        const action = carePlan.contained?.[0]?.action?.[0];
        if (action && action.title) {
          setPsaReminder(`${action.title}: ${action.description}`);
        }
      })
      .catch((err) => console.error("Error fetching PSA reminder:", err));
    fetchFHIR<Condition>("Condition", `patient=${selectedPatientId}`).then((results) =>
      setConditions(results.filter((c) => c.clinicalStatus?.coding?.[0]?.code !== "resolved"))
    );
    fetchFHIR<MedicationStatement>("MedicationStatement", `patient=${selectedPatientId}`).then(
      (results) => setMedications(results.filter((m: MedicationStatement) => m.status === "active"))
    );
    fetchFHIR<Observation>(
      "Observation",
      `category=laboratory&patient=${selectedPatientId}&_count=1000`
    ).then((results) => {
      const numericLabs = results.filter((lab) => lab.valueQuantity?.value != null);
      const sortedLabs = [...numericLabs].sort((a, b) => {
        const dateA = new Date(a.effectiveDateTime || 0).getTime();
        const dateB = new Date(b.effectiveDateTime || 0).getTime();
        return dateB - dateA; // descending order
      });
      setLabs(sortedLabs);
    });
    fetchFHIR<Procedure>("Procedure", `patient=${selectedPatientId}`).then((results) => {
      const sortedProcedures = [...results].sort((a, b) => {
        const dateA = new Date(a.performedDateTime || 0).getTime();
        const dateB = new Date(b.performedDateTime || 0).getTime();
        return dateB - dateA; // descending order
      });
      setProcedures(sortedProcedures);
    });
    fetchFHIR<AllergyIntolerance>("AllergyIntolerance", `patient=${selectedPatientId}`).then(
      setAllergies
    );
    fetchFHIR<FamilyMemberHistory>("FamilyMemberHistory", `patient=${selectedPatientId}`).then(
      setFamilyHistories
    );
    fetchFHIR<Immunization>("Immunization", `patient=${selectedPatientId}`).then(setImmunizations);
    fetch(
      `${FHIR_SERVER}/Measure/CMS138FHIRPreventiveTobaccoCessation/$evaluate-measure?subject=Patient/${selectedPatientId}&periodStart=2025-01-01T00:00:00&periodEnd=2025-12-31T23:59:59`
    )
      .then((res) => res.json())
      .then((report) => {
        setMeasureReport(report);
      })
      .catch((err) => console.error("Error fetching measure report:", err));
    fetchFHIR<Observation>("Observation", `code=72166-2&patient=${selectedPatientId}`).then(
      (results) => {
        if (results.length) {
          const latest = results.sort(
            (a, b) =>
              new Date(b.effectiveDateTime || 0).getTime() -
              new Date(a.effectiveDateTime || 0).getTime()
          )[0];
          setLatestSmokingObservation(latest);
        }
      }
    );
  }, [selectedPatientId, encounterDate]);

  // Handler for "No Change" smoking status update
  async function handleNoChangeSmokingStatus(latest: Observation | null) {
    if (!latest) return;
    const updated = {
      ...latest,
      id: undefined,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-smokingstatus"],
      },
      effectiveDateTime: `${encounterDate || new Date().toISOString().slice(0, 10)}T08:00:00-10:00`,
    };
    try {
      const res = await fetch(`${FHIR_SERVER}/Observation`, {
        method: "POST",
        headers: { "Content-Type": "application/fhir+json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed to post updated smoking status");
      alert("Updated smoking history recorded.");
      setShowSmokingStatusPrompt(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update smoking history.");
    }
  }

  async function handleEncounterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!encounterDate || !cpt) return;

    const encounterResource = {
      resourceType: "Encounter",
      meta: {
        profile: ["http://hl7.org/fhir/us/qicore/StructureDefinition/qicore-encounter"],
      },
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
      },
      type: [
        {
          coding: [
            {
              system: cpt.startsWith("G")
                ? "http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets"
                : "http://www.ama-assn.org/go/cpt",
              code: cpt,
              display:
                cpt === "G0439"
                  ? "Annual wellness visit, includes a personalized prevention plan of service (pps), subsequent visit"
                  : "",
            },
          ],
        },
      ],
      subject: {
        reference: `Patient/${selectedPatientId}`,
      },
      period: {
        start: `${encounterDate}T08:00:00-10:00`,
        end: `${encounterDate}T08:20:00-10:00`,
      },
    };

    try {
      const res = await fetch(`${FHIR_SERVER}/Encounter`, {
        method: "POST",
        headers: { "Content-Type": "application/fhir+json" },
        body: JSON.stringify(encounterResource),
      });

      if (!res.ok) throw new Error("Failed to create Encounter");
      alert("Encounter created successfully.");
      setShowEncounterForm(false);
      setEncounterDate("");
      setIcd10("");
      setCpt("");
    } catch (err) {
      console.error(err);
      alert("Failed to create encounter.");
    }
  }

  // Decide when to show smoking prompt vs. form
  useEffect(() => {
    if (!measureReport) return;

    const group1 = measureReport.group?.[0];
    const populations = group1?.population || [];
    const denom =
      populations.find((p: any) => p.code?.coding?.[0]?.display === "Denominator")?.count ?? 0;
    const numer =
      populations.find((p: any) => p.code?.coding?.[0]?.display === "Numerator")?.count ?? 0;

    if (denom > 0 && numer === 0) {
      if (!latestSmokingObservation) {
        // No history at all: show fresh-entry form
        setShowSmokingForm(true);
        setShowSmokingStatusPrompt(false);
      } else {
        // Has history but may be stale
        const latestDate = new Date(latestSmokingObservation.effectiveDateTime || 0).getTime();
        const threshold = encounterDate
          ? new Date(`${encounterDate}T00:00:00-10:00`).getTime()
          : Date.now() - 365 * 24 * 60 * 60 * 1000;
        if (latestDate < threshold) {
          // Old history: prompt for update
          setShowSmokingStatusPrompt(true);
          setShowSmokingForm(false);
        } else {
          // Up-to-date: hide both
          setShowSmokingStatusPrompt(false);
          setShowSmokingForm(false);
        }
      }
    } else {
      // Does not need screening: hide both
      setShowSmokingStatusPrompt(false);
      setShowSmokingForm(false);
    }
  }, [measureReport, latestSmokingObservation, encounterDate]);

  return (
    <>
      <div className="mb-4 p-4 bg-gray-50 border rounded">
        <label className="block font-medium mb-1">Select Patient</label>
        <select
          className="border p-2 rounded w-full"
          value={selectedPatientId}
          onChange={(e) => setSelectedPatientId(e.target.value)}
        >
          {availablePatients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name?.[0]?.given?.join(" ")} {p.name?.[0]?.family} ({p.id})
            </option>
          ))}
        </select>
      </div>
      {psaReminder && (
        <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
          <p className="font-semibold">🔔 Reminder</p>
          <p>{psaReminder}</p>
        </div>
      )}
      {measureReport && (
        <div className="mb-4 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700">
          <h2 className="text-xl font-semibold mb-2">📊 Tobacco Cessation Measure Report</h2>
          <p className="mb-2">
            <strong>Status:</strong> {measureReport.status}
          </p>
          <p className="mb-2">
            <strong>Measurement Period:</strong> {measureReport.period?.start?.slice(0, 10)} to{" "}
            {measureReport.period?.end?.slice(0, 10)}
          </p>
          {measureReport.group?.map((group: any, i: number) => (
            <div key={i} className="mb-2">
              <h3 className="font-bold">Group {i + 1}</h3>
              <ul className="ml-4 list-disc">
                {group.population?.map((pop: any, j: number) => (
                  <li key={j}>
                    {pop.code?.coding?.[0]?.display ?? "Unknown"}: {pop.count}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {measureReport.group.every((group: any) =>
            group.population.every((pop: any) => pop.count === 0)
          ) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-300 text-blue-800 rounded">
              <p className="mb-2">
                This patient has no qualifying encounters documented in 2025. Would you like to
                create a qualifying office visit now to ensure they are counted in this measure?
              </p>
              <button
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setShowEncounterForm(true)}
              >
                Create Encounter
              </button>
            </div>
          )}
        </div>
      )}
      {showEncounterForm && (
        <div className="mb-4 p-4 border rounded bg-white shadow">
          <h3 className="text-lg font-semibold mb-2">📝 New Encounter Form</h3>
          <form onSubmit={handleEncounterSubmit}>
            <div className="mb-2">
              <label className="block font-medium">Encounter Date</label>
              <input
                type="date"
                className="border p-1 rounded w-full"
                value={encounterDate}
                onChange={(e) => setEncounterDate(e.target.value)}
              />
            </div>
            <div className="mb-2">
              <label className="block font-medium">ICD-10-CM Code</label>
              <select
                className="border p-1 rounded w-full"
                value={icd10}
                onChange={(e) => setIcd10(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="Z00.00">
                  Z00.00 - General adult medical exam without abnormal findings
                </option>
                <option value="Z00.01">
                  Z00.01 - General adult medical exam with abnormal findings
                </option>
                <option value="Z00.121">Z00.121 - Well child visit, 12-17 years</option>
                <option value="Z00.129">Z00.129 - Well child visit, NOS</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block font-medium">CPT Code</label>
              <select
                className="border p-1 rounded w-full"
                value={cpt}
                onChange={(e) => setCpt(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="99384">99384 - Initial preventive visit, 12-17 years</option>
                <option value="99385">99385 - Initial preventive visit, 18-39 years</option>
                <option value="99394">99394 - Periodic preventive visit, 12-17 years</option>
                <option value="99395">99395 - Periodic preventive visit, 18-39 years</option>
                <option value="G0438">G0438 - Initial Annual Wellness Visit</option>
                <option value="G0439">G0439 - Subsequent Annual Wellness Visit</option>
              </select>
            </div>
            <button
              type="submit"
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Submit
            </button>
            <button
              type="button"
              className="mt-2 ml-2 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
              onClick={() => setShowEncounterForm(false)}
            >
              Cancel
            </button>
          </form>
        </div>
      )}
      {patient && (
        <div className="mb-4 p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold">👤 Patient</h2>
          <p>
            {patient.name?.[0]?.given?.join(" ")} {patient.name?.[0]?.family}
          </p>
          <p>DOB: {patient.birthDate}</p>
          <p>Gender: {patient.gender}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Smoking Status Prompt, shown if needed */}
        {showSmokingStatusPrompt && (
          <div className="mb-4 p-4 bg-orange-100 border-l-4 border-orange-500 text-orange-800 rounded">
            <p className="font-semibold mb-2">🚭 Smoking Status</p>
            <p className="italic mb-2">
              Last recorded smoking status:{" "}
              {latestSmokingObservation?.effectiveDateTime?.slice(0, 10)} —{" "}
              {latestSmokingObservation?.valueCodeableConcept?.text ??
                latestSmokingObservation?.valueCodeableConcept?.coding?.[0]?.display}
            </p>
            <p>
              The last documented smoking status is over a year old. Has anything changed in the
              patient's tobacco use since then?
            </p>
            <div className="mt-2 space-x-2">
              <button
                onClick={() => handleNoChangeSmokingStatus(latestSmokingObservation)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                No Change
              </button>
              <button
                onClick={() => {
                  setShowSmokingStatusPrompt(false);
                  setShowSmokingForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Yes — Update
              </button>
              <button
                onClick={() => setShowSmokingStatusPrompt(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {showSmokingForm && (
          <SmokingStatusForm
            patientId={selectedPatientId}
            onSubmit={() => setShowSmokingForm(false)}
            onCancel={() => setShowSmokingForm(false)}
          />
        )}
        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">⚠️ Allergies</h2>
            <ul>
              {allergies.map((a: AllergyIntolerance) => (
                <li key={a.id}>
                  {getDisplayText(a.code)}
                  {(() => {
                    const status = getCodingDisplay(a.clinicalStatus?.coding);
                    return status !== "Unknown" ? ` — ${status}` : "";
                  })()}
                  {/* {a.note?.[0]?.text ? ` — ${a.note[0].text}` : ""} */}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">🩺 Conditions</h2>
            <ul>
              {conditions.map((c: Condition) => (
                <li key={c.id}>
                  {getDisplayText(c.code)}
                  {(() => {
                    const status = getCodingDisplay(c.clinicalStatus?.coding);
                    return status !== "Unknown" ? ` — ${status}` : "";
                  })()}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <MuiCard>
          <MuiCardContent>
            <Typography variant="h6" gutterBottom>
              💊 Medications
            </Typography>
            <List dense>
              {medications.map((m: MedicationStatement, index) => (
                <React.Fragment key={m.id || index}>
                  <ListItem>
                    <ListItemText
                      primary={getDisplayText(m.medicationCodeableConcept)}
                      secondary={
                        m.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity
                          ? `${formatQuantity(m.dosage[0].doseAndRate[0].doseQuantity)}`
                          : null
                      }
                    />
                  </ListItem>
                  {index < medications.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          </MuiCardContent>
        </MuiCard>

        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">🧪 Labs</h2>
            <ul>
              {Object.entries(groupObservationsByDate(labs))
                .sort(([a], [b]) => b.localeCompare(a)) // descending date order
                .map(([date, observations]) => (
                  <li key={date}>
                    <strong>{date}</strong>
                    <ul>
                      {observations.map((lab) => (
                        <li key={lab.id}>
                          {getDisplayText(lab.code)}: {formatQuantity(lab.valueQuantity)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">🧾 Procedures</h2>
            <ul>
              {Object.entries(groupProceduresByDate(procedures))
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, procs]) => {
                  const byId = Object.fromEntries(
                    procs.filter((p) => p.id).map((p) => [`Procedure/${p.id!}`, p])
                  );
                  const childToParent: Record<string, string> = {};
                  procs.forEach((p) => {
                    if (p.id && p.partOf) {
                      p.partOf.forEach((po) => {
                        if (po.reference) {
                          childToParent[p.id!] = po.reference;
                        }
                      });
                    }
                  });

                  const parentGroups: Record<string, Procedure[]> = {};
                  procs.forEach((p) => {
                    const parentId = childToParent[p.id!];
                    if (p.id && parentId && byId[parentId]) {
                      if (!parentGroups[parentId]) parentGroups[parentId] = [];
                      parentGroups[parentId].push(p);
                    }
                  });

                  const shown = new Set<string>();
                  return (
                    <li key={date}>
                      <strong>{date}</strong>
                      <ul>
                        {procs.map((p) => {
                          if (!p.id) return null;
                          if (childToParent[p.id]) return null; // skip child here
                          shown.add(p.id);
                          const children = parentGroups[`Procedure/${p.id}`] || [];
                          const description = [
                            getDisplayText(p.code).replace(/\s*\(procedure\)$/i, ""),
                            ...children.map((c) =>
                              getDisplayText(c.code).replace(/\s*\(procedure\)$/i, "")
                            ),
                          ].join(" with ");
                          return <li key={p.id}>{description}</li>;
                        })}
                      </ul>
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">💉 Immunizations</h2>
            <ul>
              {immunizations
                .sort((a, b) =>
                  (b.occurrenceDateTime || "").localeCompare(a.occurrenceDateTime || "")
                )
                .map((imm) => (
                  <li key={imm.id}>
                    {imm.occurrenceDateTime?.slice(0, 10)} —{" "}
                    {getDisplayText(imm.vaccineCode).slice(0, 60)}...
                    {imm.site?.coding?.[0]?.display ? ` — ${imm.site.coding[0].display}` : ""}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-2">👪 Family History</h2>
            <ul>
              {familyHistories.map((fh) => (
                <li key={fh.id}>
                  {getDisplayText(fh.relationship).replace(
                    /\s*\((disorder|qualifier value)\)$/i,
                    ""
                  )}
                  :
                  <ul>
                    {fh.condition?.map((cond, index) => (
                      <li key={index}>
                        {getDisplayText(cond.code).replace(
                          /\s*\((disorder|qualifier value)\)$/i,
                          ""
                        )}
                        {cond.outcome?.coding?.[0]?.display
                          ? ` — ${cond.outcome.coding[0].display.replace(
                              /\s*\((disorder|qualifier value)\)$/i,
                              ""
                            )}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
