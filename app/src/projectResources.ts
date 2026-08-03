export type ProjectResourceKind = 'contract' | 'invoice' | 'payment';

export type ProjectResourceField = {
  label: string;
  value: string;
};

export type ProjectResourceRecord = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  status: string;
  channel?: string;
  fields: ProjectResourceField[];
};

export type ProjectResourceRecords = Record<ProjectResourceKind, ProjectResourceRecord[]>;

export type ProjectResourceViewerState = {
  kind: ProjectResourceKind;
  recordId: string | null;
};

export type ProjectDocumentContext = {
  id: string;
  name: string;
  brand: string;
};
