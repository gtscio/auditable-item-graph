// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IPatchOperation } from "@gtsc/core";
import type { IAuditableItemGraphChangeset } from "../IAuditableItemGraphChangeset";
import type { IAuditableItemGraphVertex } from "../IAuditableItemGraphVertex";

/**
 * Response to getting an auditable item graph vertex.
 */
export interface IAuditableItemGraphGetResponse {
	/**
	 * The response body.
	 */
	body: {
		/**
		 * Whether the vertex has been verified.
		 */
		verified?: boolean;

		/**
		 * The verification patches including any failure information.
		 */
		verification?: {
			created: number;
			patches: IPatchOperation[];
			failure?: string;
			failureProperties?: { [id: string]: unknown };
		}[];

		/**
		 * The vertex data.
		 */
		vertex: IAuditableItemGraphVertex;

		/**
		 * Changesets containing time sliced changes to the vertex.
		 */
		changesets?: IAuditableItemGraphChangeset[];
	};
}
