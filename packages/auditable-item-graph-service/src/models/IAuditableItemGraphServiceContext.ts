// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Context for the auditable item graph service.
 */
export interface IAuditableItemGraphServiceContext {
	/**
	 * The current timestamp.
	 */
	now: number;

	/**
	 * The identity of the user.
	 */
	userIdentity: string;

	/**
	 * The identity of the node.
	 */
	nodeIdentity: string;
}
