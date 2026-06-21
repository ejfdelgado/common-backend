CREATE TABLE `ejfexperiments.app_data.articles` (
  id STRING NOT NULL,
  title STRING,
  path STRING,
  created_at TIMESTAMP
);

CREATE SEARCH INDEX articles_search_index
ON `ejfexperiments.app_data.articles`
(title, path);


-- Where could we place this??
--PARTITION BY DATE(created_at)
--CLUSTER BY created_at