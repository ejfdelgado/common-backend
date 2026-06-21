import { BigQuery } from '@google-cloud/bigquery';

export const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
});

export const DATASET = 'app_data';
