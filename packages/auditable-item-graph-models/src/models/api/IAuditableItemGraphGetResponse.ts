// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IAuditableItemGraphChange } from "../IAuditableItemGraphChange";
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
		 * The verification changes including any failure information.
		 */
		verification?: {
			[epoch: number]: {
				failure?: string;
				properties?: { [id: string]: unknown };
				changes: IAuditableItemGraphChange[];
			};
		};

		/**
		 * The vertex data.
		 */
		vertex: IAuditableItemGraphVertex;
	};
}
