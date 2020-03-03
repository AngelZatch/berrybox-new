import { Component, OnInit, ViewChild } from '@angular/core';
import { BoxService } from './../../../../shared/services/box.service';
import { Router, ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';

import { LikeButtonComponent } from '../../components/like-button/like-button.component';
import { JukeboxService } from './../../jukebox.service';
import { AuthService } from 'app/core/auth/auth.service';
import { Box } from 'app/shared/models/box.model';
import { User } from 'app/shared/models/user.model';
import { SyncPacket } from 'app/shared/models/sync-packet.model';
import { filter } from 'rxjs/operators';
import { PlaylistVideo } from 'app/shared/models/playlist-video.model';
import { AuthSubject } from 'app/shared/models/session.model';
import { environment } from 'environments/environment';
import { BoxFormComponent } from 'app/shared/components/box-form/box-form.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PlaylistSelectorComponent } from 'app/shared/components/playlist-selector/playlist-selector.component';
import { UserPlaylist } from 'app/shared/models/user-playlist.model';
import { PlaylistService } from 'app/shared/services/playlist.service';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-box',
    templateUrl: './box.component.html',
    styleUrls: ['./box.component.scss'],
    providers: [BoxService]
})
export class BoxComponent implements OnInit {
    /**
     * Token of the box. Unique indentifier (ObjectID from MongoDB)
     *
     * @type {string}
     * @memberof BoxComponent
     */
    token: string;

    /**
     * Box itself
     *
     * @type {Box}
     * @memberof BoxComponent
     */
    box: Box;

    /**
     * Profile picture of the box creator
     *
     * @memberof BoxComponent
     */
    public pictureLocation = '../../../assets/images/berrybox-staff-logo.png';

    /**
     * Loading flag to hide or show parts of the DOM depending on their state of readiness
     *
     * @memberof BoxComponent
     */
    loading = true;

    /**
     * The currently playing vidoe in the box. Gets refreshed by sockets and sent to the player and mood widgets
     *
     * @memberof BoxComponent
     */
    currentVideo: PlaylistVideo = null;


    /**
     * Connected user. Obtained from the auth service
     *
     * @type {User}
     * @memberof BoxComponent
     */
    user: AuthSubject = AuthService.getAuthSubject();

    /**
     * Integration of the Mood Widget component, though I'm not sure I need it anymore
     *
     * @private
     * @type {LikeButtonComponent}
     * @memberof BoxComponent
     */
    @ViewChild(LikeButtonComponent, { static: false }) private LikeButtonComponent: LikeButtonComponent;

    constructor(
        private authService: AuthService,
        private boxService: BoxService,
        private jukeboxService: JukeboxService,
        private playlistService: PlaylistService,
        private modalService: NgbModal,
        private route: ActivatedRoute,
        private router: Router,
        private toastr: ToastrService
    ) { }

    ngOnInit() {
        this.route.params.subscribe(params => {
            this.token = params.token;
            this.loadBox();
            this.listenForBoxChanges();
        });
    }

    /**
     * Loads the details of the box
     *
     * Only if you're the creator of the box. Else, you just connect to the jukeboxService and get the box from there
     *
     * @memberof BoxComponent
     */
    loadBox() {
        this.boxService.show(this.token).subscribe(
            (box: Box) => {
                this.box = box;
                this.pictureLocation = `${environment.amazonBuckets}/${environment.profilePictureBuckets}/${box.creator._id}-picture`
                // Start box once it's loaded
                this.jukeboxService.startBox(this.box);
                this.loading = false;
            }
        );
    }

    listenForBoxChanges() {
        this.jukeboxService.getBox().subscribe(
            (updatedBox: Box) => {
                this.box = updatedBox
            }
        )
    }

    loadDefaultPicture() {
        this.pictureLocation = `${environment.amazonBuckets}/${environment.profilePictureBuckets}/default-picture`;
    }

    /**
     * This is where the real-time stuff happens.
     * The box will connect to the server via socket and start synchronising with other users.
     *
     * @memberof BoxComponent
     */
    connectToSyncStream() {
        console.log('connecting sync to socket...');
        this.jukeboxService.getBoxStream()
            .pipe(
                filter(syncPacket => syncPacket instanceof SyncPacket && syncPacket.box === this.box._id)
            )
            .subscribe(
                (syncPacket: SyncPacket) => {
                    console.log('New Sync Packet', syncPacket);
                    // Dirty, to be changed
                    if (_.has(syncPacket.item, 'video')) {
                        this.currentVideo = syncPacket.item; // Given to the player by 1-way binding
                    }
                },
                error => {
                    console.error(error);
                    console.log('socket offline');
                }
            );
    }


    /**
     * Actions when the player changes state
     *
     * @param {*} event
     * @memberof BoxComponent
     */
    onPlayerStateChange(event: any) {
        if (event === 'ready') {
            this.connectToSyncStream();
        }
    }

    /**
     * Sends a command to skip the currently playing video
     *
     * @memberof BoxComponent
     */
    skipVideo() {
        this.jukeboxService.skipVideo();
    }

    openBoxSettings() {
        if (this.jukeboxService.evaluateCommandPower()) {
            const modalRef = this.modalService.open(BoxFormComponent)
            modalRef.componentInstance.title = `Edit Box Settings`
            modalRef.componentInstance.box = _.cloneDeep(this.box)
        }
    }

    addToPlaylist() {
        const modalRef = this.modalService.open(PlaylistSelectorComponent)
        modalRef.componentInstance.selectedPlaylist$.subscribe(
            (playlistId: string) => {
                this.playlistService.addVideoToPlaylist(playlistId, { videoId: this.currentVideo.video._id }).toPromise()
                this.toastr.success('Video added', 'Success')
            }
        )
    }
}
