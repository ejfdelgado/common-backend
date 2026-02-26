import { BigQuery } from '@google-cloud/bigquery';

export const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
});

export const DATASET = 'app_data';
export const TABLE = 'articles';

export const TABLE_PATH = `${process.env.GCP_PROJECT_ID}.${DATASET}.${TABLE}`;