import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserPlaylist } from '../models/user-playlist.model';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';

@Injectable({
    providedIn: 'root'
})
export class PlaylistService {

    constructor(
        private http: HttpClient
    ) { }

    /**
     * Gets all public playlists
     *
     * @returns The list of public playlists
     * @memberof PlaylistService
     */
    index(): Observable<Array<UserPlaylist>> {
        return this.http.get<Array<UserPlaylist>>(`${environment.araza}/playlists`);
    }

    /**
     * Gets one playlist
     *
     * @param id The ObjectId of the playlist
     * @returns
     * @memberof PlaylistService
     */
    show(id: string): Observable<UserPlaylist> {
        return this.http.get<UserPlaylist>(`${environment.araza}/playlists/${id}`);
    }

    /**
     * Stores a new playlist in the database
     *
     * @param playlist
     * @returns
     * @memberof PlaylistService
     */
    store(playlist: Partial<UserPlaylist>): Observable<UserPlaylist> {
        return this.http.post<UserPlaylist>(`${environment.araza}/playlists`, playlist);
    }

    /**
     * Updates a playlist
     *
     * @param playlist
     * @returns
     * @memberof PlaylistService
     */
    update(playlist: Partial<UserPlaylist>): Observable<UserPlaylist> {
        return this.http.put<UserPlaylist>(`${environment.araza}/playlists/${playlist._id}`, playlist);
    }

    /**
     * Updates a playlist
     *
     * @param command
     * @returns
     * @memberof UserService
     */
    addVideoToPlaylist(playlist: string, video: { videoId?: string, videoLink?: string }): Observable<UserPlaylist> {
        return this.http.post<UserPlaylist>(`${environment.araza}/playlists/${playlist}/videos`, video)
    }

    removeVideoFromPlaylist(playlist: string, video: string): Observable<UserPlaylist> {
        return this.http.delete<UserPlaylist>(`${environment.araza}/playlists/${playlist}/videos/${video}`)
    }

    /**
     * Deletes a playlist
     *
     * @param id
     * @returns
     * @memberof PlaylistService
     */
    delete(id: string): Observable<UserPlaylist> {
        return this.http.delete<UserPlaylist>(`${environment.araza}/playlists/${id}`);
    }
}
