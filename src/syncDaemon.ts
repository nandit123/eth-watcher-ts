import * as dotenv from 'dotenv';
dotenv.config();

import * as cron from 'node-cron';
import {createConnection, getConnection, getConnectionOptions} from 'typeorm';
import ProgressRepository from './repositories/data/progressRepository';
import Contract from './models/contract/contract';
import Event from './models/contract/event';
import Store from './store';
import DataService from './services/dataService';
import GraphqlService from './services/graphqlService';

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at:', p, 'reason:', reason);
	// TODO: send to log system
});

console.log('Cron daemon is started');
(async (): Promise<void> => {
	const connectionOptions = await getConnectionOptions();
	createConnection(connectionOptions).then(async () => {

		const dataService = new DataService();
		const graphqlService = new GraphqlService();

		let status = 'waiting';
		cron.schedule('0 * * * * *', async () => { // every minute
			if (status !== 'waiting') {
				console.log('Cron already running');
				return;
			}

			status = 'running';

			// start Store without autoupdate data
			const store = Store.getStore();
			await store.syncData();

			const contracts: Contract[] = Store.getStore().getContracts();
			const events: Event[] = Store.getStore().getEvents();

			console.log('Contracts', contracts.length);
			console.log('events', events.length);

			const progressRepository: ProgressRepository = getConnection().getCustomRepository(ProgressRepository);
			for (const contract of contracts) {
				for (const event of events) {
					console.log('Contract', contract.contractId, 'Event', event.name);

					await DataService.syncEventForContract({ graphqlService, dataService, progressRepository }, event, contract);
				}
			}

			status = 'waiting';
		});
	});
})();