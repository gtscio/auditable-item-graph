// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { MimeTypes } from "@gtsc/web";
import type { VerifyDepth } from "../verifyDepth";

/**
 * Get an auditable item graph vertex.
 */
export interface IAuditableItemGraphGetRequest {
	/**
	 * The headers which can be used to determine the response data type.
	 */
	headers?: {
		// False positive
		// eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
		Accept: typeof MimeTypes.Json | typeof MimeTypes.JsonLd;
	};

	/**
	 * The parameters from the path.
	 */
	pathParams: {
		/**
		 * The id of the vertex to get.
		 */
		id: string;
	};

	/**
	 * The query parameters.
	 */
	query?: {
		/**
		 * Whether to include deleted aliases, resource, edges, defaults to false.
		 */
		includeDeleted?: boolean;

		/**
		 * Whether to include the changesets of the vertex, defaults to false.
		 */
		includeChangesets?: boolean;

		/**
		 * How many signatures to verify, none, current or all, defaults to "none".
		 */
		verifySignatureDepth?: VerifyDepth;
	};
}
