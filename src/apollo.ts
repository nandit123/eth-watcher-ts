import { ApolloClient, gql, HttpLink, InMemoryCache, NormalizedCacheObject, split } from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import * as ws from 'ws';
import * as fetch from "node-fetch";
import env from './env';

export default class Apollo {

	public client: ApolloClient<NormalizedCacheObject> = null;

	public constructor (endpoint = env.GRAPHQL_URI) {
		const GRAPHQL_ENDPOINT = `ws://${endpoint}/graphql`;
		const HTTP_ENDPOINT = `http://${endpoint}/graphql`;

		const subscriptionClient = new SubscriptionClient(GRAPHQL_ENDPOINT, {
			reconnect: true,
		}, ws);
		const wsLink = new WebSocketLink(subscriptionClient);

		const httpLink = new HttpLink({
			uri: HTTP_ENDPOINT,
			fetch,
		});

		const link = split(
			({ query }) => {
				const definition = getMainDefinition(query);
				return (
					definition.kind === "OperationDefinition" &&
					definition.operation === "subscription"
				);
			},
			wsLink,
			httpLink
		);
		
		this.client = new ApolloClient({
			link,
			cache: new InMemoryCache(),
		});
	}

	public async subscribe(query: string, onNext: (value: any) => void, onError?: (error: any) => void): Promise<any> { // eslint-disable-line
		const observable = await this.client.subscribe({
			query: gql`${query}`,
		});

		observable.subscribe({
			next(data) {
				onNext(data);
			},
			error(value) {
				onError && onError(value);
			}
		});
	}

	public async query(query: string): Promise<any> { // eslint-disable-line
		const { data } = await this.client.query({
			query: gql`${query}`,
		}); 

		return data;
	}
}
