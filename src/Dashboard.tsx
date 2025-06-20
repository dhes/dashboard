// Dashboard.tsx
import React from "react";
import type { Observation, Patient, Procedure, MedicationStatement, Condition, AllergyIntolerance, FamilyMemberHistory, Immunization } from "fhir/r4";
import { useEffect, useState } from "react";
// import { Card, CardContent } from "@/components/ui/card";
import { Card, CardContent } from "./components/ui/card";
import { Card as MuiCard, CardContent as MuiCardContent, Typography, List, ListItem, ListItemText, Divider } from '@mui/material';

const FHIR_SERVER = "http://localhost:8080/fhir"; // Replace with your actual URL
const PATIENT_ID = "heslinga-dan"; // Replace with your actual Patient ID

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
  const [labs, setLabs] = useState<Observation[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [medications, setMedications] = useState<MedicationStatement[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [familyHistories, setFamilyHistories] = useState<FamilyMemberHistory[]>([]);
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);
  const [psaReminder, setPsaReminder] = useState<string | null>(null);

  useEffect(() => {
    fetchFHIR<Patient>("Patient", `_id=${PATIENT_ID}`).then((results) => setPatient(results[0]));
    fetch(`${FHIR_SERVER}/PlanDefinition/psa-reminder/$apply?subject=Patient/${PATIENT_ID}`)
      .then((res) => res.json())
      .then((carePlan) => {
        const action = carePlan.contained?.[0]?.action?.[0];
        if (action && action.title) {
          setPsaReminder(`${action.title}: ${action.description}`);
        }
      })
      .catch((err) => console.error("Error fetching PSA reminder:", err));
    fetchFHIR<Condition>("Condition", `patient=${PATIENT_ID}`).then((results) =>
      setConditions(results.filter((c) => c.clinicalStatus?.coding?.[0]?.code !== "resolved"))
    );
    // fetchFHIR<MedicationStatement>("MedicationStatement", `patient=${PATIENT_ID}`).then(setMedications);
    fetchFHIR<MedicationStatement>("MedicationStatement", `patient=${PATIENT_ID}`).then((results) =>
      setMedications(results.filter((m: MedicationStatement) => m.status === "active"))
    );
    fetchFHIR<Observation>(
      "Observation",
      `category=laboratory&patient=${PATIENT_ID}&_count=1000`
    ).then((results) => {
      const numericLabs = results.filter((lab) => lab.valueQuantity?.value != null);
      const sortedLabs = [...numericLabs].sort((a, b) => {
        const dateA = new Date(a.effectiveDateTime || 0).getTime();
        const dateB = new Date(b.effectiveDateTime || 0).getTime();
        return dateB - dateA; // descending order
      });
      setLabs(sortedLabs);
    });
    fetchFHIR<Procedure>("Procedure", `patient=${PATIENT_ID}`).then((results) => {
      const sortedProcedures = [...results].sort((a, b) => {
        const dateA = new Date(a.performedDateTime || 0).getTime();
        const dateB = new Date(b.performedDateTime || 0).getTime();
        return dateB - dateA; // descending order
      });
      setProcedures(sortedProcedures);
    });
    fetchFHIR<AllergyIntolerance>("AllergyIntolerance", `patient=${PATIENT_ID}`).then(setAllergies);
    fetchFHIR<FamilyMemberHistory>("FamilyMemberHistory", `patient=${PATIENT_ID}`).then(setFamilyHistories);
    fetchFHIR<Immunization>("Immunization", `patient=${PATIENT_ID}`).then(setImmunizations);
  }, []);

  return (
    <>
      {psaReminder && (
        <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
          <p className="font-semibold">🔔 Reminder</p>
          <p>{psaReminder}</p>
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
                  const byId = Object.fromEntries(procs.filter(p => p.id).map((p) => [`Procedure/${p.id!}`, p]));
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
                .sort((a, b) => (b.occurrenceDateTime || "").localeCompare(a.occurrenceDateTime || ""))
                .map((imm) => (
                  <li key={imm.id}>
                    {imm.occurrenceDateTime?.slice(0, 10)} — {getDisplayText(imm.vaccineCode).slice(0, 60)}...
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
                  {getDisplayText(fh.relationship).replace(/\s*\((disorder|qualifier value)\)$/i, "")}:
                  <ul>
                    {fh.condition?.map((cond, index) => (
                      <li key={index}>
                        {getDisplayText(cond.code).replace(/\s*\((disorder|qualifier value)\)$/i, "")}
                        {cond.outcome?.coding?.[0]?.display
                          ? ` — ${cond.outcome.coding[0].display.replace(/\s*\((disorder|qualifier value)\)$/i, "")}`
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
