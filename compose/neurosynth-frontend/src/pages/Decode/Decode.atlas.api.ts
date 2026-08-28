import { axiosInstance, neurosynthConfig } from 'api/api.state';
import { AtlasCoordinate, AtlasReadoutResponse, parseAtlasReadoutResponse } from './Decode.atlas.types';

export const fetchAtlasReadout = async (
    coordinate: AtlasCoordinate,
    signal: AbortSignal
): Promise<AtlasReadoutResponse> => {
    const response = await axiosInstance.get<unknown>(`${neurosynthConfig.basePath}/atlases/readout`, {
        params: { x: coordinate.x, y: coordinate.y, z: coordinate.z },
        signal,
        skipAuth: true,
    });
    return parseAtlasReadoutResponse(response.data, coordinate);
};
