CREATE TABLE `product_thumbnails` (
	`productId` varchar(128) NOT NULL,
	`width` smallint NOT NULL,
	`sourceHash` varchar(16) NOT NULL,
	`contentType` varchar(32) NOT NULL,
	`data` mediumtext NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `product_thumbnails_productId_width_sourceHash_pk` PRIMARY KEY(`productId`,`width`,`sourceHash`)
);
--> statement-breakpoint
CREATE INDEX `idx_thumbnails_product` ON `product_thumbnails` (`productId`);