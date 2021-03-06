import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { UserPlaylist } from 'app/shared/models/user-playlist.model';
import { PlaylistService } from 'app/shared/services/playlist.service';
import { AuthSubject } from 'app/shared/models/session.model';

@Component({
    selector: 'app-playlist-form',
    templateUrl: './playlist-form.component.html',
    styleUrls: ['./playlist-form.component.scss']
})
export class PlaylistFormComponent implements OnInit {
    @Input() title: string
    @Input() playlist: UserPlaylist
    @Input() user: AuthSubject

    @Output() playlistSaved: EventEmitter<any> = new EventEmitter()

    context: 'create' | 'edit' = 'edit'

    constructor(
        public activeModal: NgbActiveModal,
        public playlistService: PlaylistService
    ) { }

    ngOnInit() {
        if (!this.playlist) {
            this.context = 'create'
            this.playlist = new UserPlaylist({ user: { _id: this.user._id, name: this.user.name } })
        }
    }

    onSubmit() {
        if (this.context === 'create') {
            this.playlistService.store(this.playlist).subscribe(
                (response: UserPlaylist) => {
                    this.playlistSaved.emit();
                    this.activeModal.close();
                }
            )
        } else {
            this.playlistService.update(this.playlist).subscribe(
                (response: UserPlaylist) => {
                    this.playlistSaved.emit();
                    this.activeModal.close();
                }
            )
        }
    }

}
