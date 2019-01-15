import { ArmObj, SlotConfigNames } from '../../../../models/WebAppModels';
import { MakeArmCall } from '../../../ArmHelper';
import { RootState } from '../../../types';
import { getArmEndpointAndTokenFromState } from '../../../StateUtilities';

const slotConfigNamesApiService = {
  fetchSlotConfig: async (state: RootState): Promise<ArmObj<SlotConfigNames>> => {
    let productionResourceId = state.site.resourceId;
    if (productionResourceId.includes('/slots/')) {
      productionResourceId = productionResourceId.split('/slots/')[0];
    }
    const resourceId = `${productionResourceId}/config/slotconfignames`;
    const { armEndpoint, authToken } = getArmEndpointAndTokenFromState(state);
    return await MakeArmCall(armEndpoint, authToken, resourceId, 'FetchSlotConfig');
  },
  updateSlotConfig: async (state: RootState, newConfigName: ArmObj<SlotConfigNames>): Promise<ArmObj<SlotConfigNames>> => {
    let productionResourceId = state.site.resourceId;
    if (productionResourceId.includes('/slots/')) {
      productionResourceId = productionResourceId.split('/slots/')[0];
    }
    const resourceId = `${productionResourceId}/config/slotconfignames`;
    const { armEndpoint, authToken } = getArmEndpointAndTokenFromState(state);
    return await MakeArmCall(armEndpoint, authToken, resourceId, 'UpdateSlotConfig', 'PUT', newConfigName);
  },
};

export default slotConfigNamesApiService;
