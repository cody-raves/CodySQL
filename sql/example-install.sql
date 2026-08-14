-- Example installer file.
-- Drop your own .sql files into this folder (codysql/sql/) and run them
-- from the in-game UI: CodySQL → SQL Files → select → Execute.

CREATE TABLE IF NOT EXISTS `codysql_example` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `note` VARCHAR(190) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO `codysql_example` (`note`) VALUES ('Hello from CodySQL!');

-- Semicolons inside strings are handled fine; this is one statement:
INSERT INTO `codysql_example` (`note`) VALUES ('strings; with; semicolons; work');

-- Clean up after yourself if you were just testing:
-- DROP TABLE `codysql_example`;
