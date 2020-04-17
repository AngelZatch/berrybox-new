import { Component, OnInit, Output, Input, EventEmitter, AfterViewChecked, ElementRef, ViewChild, Renderer2, AfterViewInit } from '@angular/core';
import * as _ from 'lodash'
import { ToastrService } from 'ngx-toastr';
import { filter, debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { NgbModal, NgbDropdown } from '@ng-bootstrap/ng-bootstrap';
import { EmojiSearch } from '@ctrl/ngx-emoji-mart';
import { EmojiData } from '@ctrl/ngx-emoji-mart/ngx-emoji/public_api';

import { JukeboxService } from './../../jukebox.service';
import { Message, FeedbackMessage } from '@teamberry/muscadine';
import { SubmissionPayload } from 'app/shared/models/playlist-payload.model';
import { AuthSubject } from 'app/shared/models/session.model';
import { AuthService } from 'app/core/auth/auth.service';
import { BoxFormComponent } from 'app/shared/components/box-form/box-form.component';
import { Box } from 'app/shared/models/box.model';
import { LoginFormComponent } from 'app/shared/components/login-form/login-form.component';
import { SignupFormComponent } from 'app/shared/components/signup-form/signup-form.component';
import { Observable, fromEvent } from 'rxjs';

export type Panel = 'chat' | 'queue' | 'users' | 'commands' | 'help' | 'favorites' | 'search'

@Component({
    selector: 'app-panel',
    templateUrl: './panel.component.html',
    styleUrls: ['./panel.component.scss'],
})
export class PanelComponent implements OnInit, AfterViewInit, AfterViewChecked {
    @Input() boxToken: string;
    user: AuthSubject = AuthService.getAuthSubject();
    box: Box;

    @Output() skipEvent = new EventEmitter();
    contents = '';
    hasCommand = false;
    activePanel: Panel = 'chat';

    /**
     * Boolean to determine whether new messages have been received and the chat panel is not active
     *
     * @memberof PanelComponent
     */
    newMessages = false;

    /**
     * Whether the emoji picker is displayed
     *
     * @memberof PanelComponent
     */
    isEmojiPickerDisplayed = false;

    @ViewChild('chatbox') chatbox: ElementRef;
    @ViewChild('emojiPicker') emojiPicker: ElementRef;
    @ViewChild('emojiButton') emojiButton: ElementRef;
    @ViewChild('emojiTypeahead') emojiTypeahead: NgbDropdown;

    emojiDetectionRegEx = new RegExp(/:[\w]{2,}/, 'gmi');
    emojiReplacementRegEx = new RegExp(/:[\w]{2,}:/, 'gmi');
    emojiResults: Array<EmojiData> = [];

    constructor(
        private modalService: NgbModal,
        private jukeboxService: JukeboxService,
        private toastr: ToastrService,
        private renderer: Renderer2,
        private emojiSearch: EmojiSearch
    ) {
        // Will close the emoji picker when a click is registered outside of the chatbox, the emoji button and picker
        this.renderer.listen('window', 'click', (e: Event) => {
            if (e.target !== this.chatbox.nativeElement
                && e.target !== this.emojiButton.nativeElement
                && e.composedPath().indexOf(this.emojiPicker.nativeElement) === -1
            ) {
                this.isEmojiPickerDisplayed = false;
            }
        })
    }

    ngOnInit() {
        this.activePanel = 'chat';
        this.connectToStream();
        this.jukeboxService.getBox().subscribe(
            (box: Box) => {
                this.box = box;
            }
        )
    }

    ngAfterViewInit() {
        this.emojiTypeahead.openChange.subscribe(
            (change: boolean) => {
                if (!change) {
                    this.chatbox.nativeElement.focus();
                }
            }
        )

        fromEvent(this.chatbox.nativeElement, 'keyup')
            .pipe(
                filter(Boolean),
                debounceTime(200),
                distinctUntilChanged(),
        )
        .subscribe(() => this.watchContents());
    }

    ngAfterViewChecked() {
        if (this.activePanel === 'chat') {
            this.adjustView();
        }
    }

    adjustView() {
        const panelSpace = document.getElementById('panel-space');
        panelSpace.scrollTop = panelSpace.scrollHeight;
    }

    showPanel(panelToken: Panel) {
        this.activePanel = panelToken;
    }

    watchContents() {
        // Reset everything
        this.hasCommand = false;
        if (this.contents.length === 0) {
            this.emojiTypeahead.close();
            return;
        }

        // Switch to command mode
        if (this.contents.indexOf('!') === 0) {
            this.hasCommand = true;
            this.emojiTypeahead.close();
            return;
        }

        // Replace full emojis
        const emojiToReplace = this.emojiReplacementRegEx.exec(this.contents);
        if (emojiToReplace && emojiToReplace.length > 0) {
            const result: Array<EmojiData> = this.emojiSearch.search(emojiToReplace[0].replace(/:/gi, ''));
            if (result.length > 0) {
                this.contents = this.contents.replace(this.emojiReplacementRegEx, result[0].native);
            }
            this.emojiTypeahead.close();
            return;
        }

        // Search for emojis to typeahead
        const emojiToSearch = this.emojiDetectionRegEx.exec(this.contents);
        if (emojiToSearch && emojiToSearch.length > 0) {
            this.emojiResults = this.emojiSearch.search(emojiToSearch[0].replace(/:/gi, ''));
            this.emojiTypeahead.open();
            return;
        }
    }

    post(event) {
        event.preventDefault();
        const contents = this.contents;
        this.contents = '';
        this.emojiResults = [];
        if (this.hasCommand && !event.ctrlKey) {
            this.handleCommands(contents);
        } else {
            this.handleMessage(contents);
        }
    }

    handleMessage(contents: string) {
        this.isEmojiPickerDisplayed = false;
        this.emojiTypeahead.close();
        const message = new Message({
            author: this.user._id,
            contents: contents,
            scope: this.boxToken,
            source: 'human',
        });
        this.jukeboxService.postMessageToSocket(message);
    }

    /**
     * Adds the selected emoji to the contents of the message
     *
     * @param {*} event
     * @memberof PanelComponent
     */
    addEmoji(event) {
        this.contents += ` ${event.emoji.native}`;
    }

    /**
     * Replaces the text by the emoji
     *
     * @param {EmojiData} emoji
     * @memberof PanelComponent
     */
    replaceEmoji(emoji: EmojiData) {
        this.contents = this.contents.replace(
            this.emojiDetectionRegEx,
            emoji.native
        )
        this.chatbox.nativeElement.focus();
    }

    /**
     * Kickstarts the use of a command in the chat when a command is clicked in the command list component
     *
     * @param {string} commandKey
     * @memberof PanelComponent
     */
    kickstartCommand(commandKey: string) {
        this.contents += `!${commandKey} `;
        this.watchContents();
    }

    handleCommands(contents: string) {
        // Trim multiple spaces in commands
        contents = contents.replace(/(\s)+/gm, ' ');
        const command = contents.substr(1).split(' ');
        const keyword = command[0];
        switch (keyword) {
            case 'add':
            case 'queue':
            case 'play':
                this.submitVideo(command[1]);
                break;

            case 'skip':
            case 'next':
                this.jukeboxService.skipVideo();
                break;

            case 'shuffle':
            case 'random':
                /* this.shuffle(); */
                break;

            case 'settings':
                this.openBoxSettings();
                break;

            case 'help':
                this.activePanel = 'help';
                break;

            case 'chat':
                this.activePanel = 'chat';
                this.newMessages = false;
                break;

            case 'playlist':
                this.activePanel = 'queue';
                break;

            case 'users':
            case 'userlist':
                this.activePanel = 'users';
                break;

            case 'search':
                this.activePanel = 'search';
                break;

            case 'commands':
            case 'macros':
                this.activePanel = 'commands';
                break;

            default:
                break;
        }
    }

    refreshChatStatus(event) {
        console.log(event);
    }

    /**
     * Submits a video by its URL. Will control if the url is valid.
     *
     * @param {string} url The YouTube URL of the video.
     * @memberof PanelComponent
     */
    submitVideo(url: string) {
        const reg = new RegExp(/(\?v=([a-z0-9\-\_]+)\&?)|(\.be\/([a-z0-9\-\_]+)\&?)/i);
        const res = reg.exec(url);

        try {
            const video: SubmissionPayload = {
                link: (res[2]) ? res[2] : res[4],
                userToken: this.user._id,
                boxToken: this.boxToken,
            };

            this.jukeboxService.submitVideo(video);
        } catch (error) {
            const message: FeedbackMessage = new FeedbackMessage({
                contents: 'The video URL you submitted is not a valid YouTube URL.',
                source: 'feedback',
                scope: this.boxToken,
                time: new Date(),
                feedbackType: 'error'
            });
            this.jukeboxService.postMessageToStream(message);
        }
    }

    /**
     * Connects to jukebox service chat stream to get messages to display
     *
     * @memberof ChatComponent
     */
    connectToStream() {
        this.jukeboxService.getBoxStream()
            .pipe( // Filtering to only act on Message instances
                filter(message => message instanceof Message && message.scope === this.boxToken)
            )
            .subscribe(
                (message: Message) => {
                    if (this.activePanel !== 'chat') {
                        if (message.source !== 'system') {
                            this.newMessages = true
                        } else {
                            this.toastr.info(message.contents, 'System')
                        }
                    }
                }
            );
    }

    openBoxSettings() {
        if (this.jukeboxService.evaluateCommandPower()) {
            const modalRef = this.modalService.open(BoxFormComponent)
            modalRef.componentInstance.title = `Edit Box Settings`
            modalRef.componentInstance.box = _.cloneDeep(this.box)
        }
    }

    openLoginPrompt() {
        this.modalService.open(LoginFormComponent);
    }

    openSignupPrompt() {
        this.modalService.open(SignupFormComponent);
    }
}
