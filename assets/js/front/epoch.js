/** globals epoch_vars */
jQuery( document ).ready( function ( $ ) {

    (function ( $, app ) {
        /**
         * Bootstrap
         *
         * @since 0.0.1
         */
        app.init = function() {
            //element for the form wrap
            app.form_wrap_el = document.getElementById( epoch_vars.form_wrap );

            //element for comments area
            app.comments_wrap_el = document.getElementById( epoch_vars.comments_wrap );

            //element for template
            app.template_el = document.getElementById( epoch_vars.comments_template_id );

            //stores comments IDs we already Have in DOM
            app.comments_store = [];

            //Will be set to true if post has no comments, may be use to shut down system in app.shutdown
            app.no_comments = false;

            //Will be set to true if comments are closed, may be use to shut down system in app.shutdown
            app.comments_close = false;

            //used to stop the system
            app.shut_it_off = false;

            /**
             * Run the system
             */
            app.comments_open();
            app.comment_count( false );

            app.poll = setTimeout( app.comment_count, epoch_vars.epoch_options.interval );


        };

        /**
         * Check if comments are open for current post
         *
         * @since 0.0.1
         */
        app.comments_open = function() {
            $.get(
                epoch_vars.api_url, {
                    action: 'comments_open',
                    epochNonce: epoch_vars.nonce,
                    postID: epoch_vars.post_id
                }
                ).done( function( response  ) {

                } ).success( function( response ) {
                    response = app.get_data_from_response( response );
                    if ( true == response ) {
                        app.get_form()
                    }else{
                        app.comments_closed = true;
                    }

                }
            );

        };

        /**
         * Get comment form
         *
         * @since 0.0.1
         */
        app.get_form = function() {
            spinner = document.getElementById( 'comment_form_spinner_id' );
            $( spinner ).show();
            $.get(
                epoch_vars.api_url, {
                    action: 'form',
                    epochNonce: epoch_vars.nonce,
                    postID: epoch_vars.post_id
                }
                ).done( function( response  ) {
                    $( spinner ).hide();
                } ).success( function( response ) {
                    response = app.get_data_from_response( response );
                    if ( 'undefined' != response.html ) {
                        app.form_wrap_el.innerHTML = response.html;
                        app.form_el = document.getElementById( epoch_vars.form_id );
                        app.form_el.removeAttribute( 'action' );
                        app.form_el.setAttribute( 'action', 'post' );

                        /**
                         * Submit form data
                         *
                         * @since 0.0.1
                         */
                        $( app.form_el ).submit( function( event ) {
                            event.preventDefault();
                            window.clearTimeout( app.poll );

                            data = $( this ).serializeArray();
                            $.post(
                                epoch_vars.submit_api_url,
                                data
                            ).complete( function () {
                                    app.poll = setTimeout( app.comment_count, epoch_vars.epoch_options.interval );
                            } ).success( function ( response ) {
                                app.last_count = 0;
                                app.get_comments( true );
                                app.form_el.reset();
                                $( '#epoch-success' ).modal({
                                    opacity:80,
                                    overlayCss: {backgroundColor:"#fff"},
                                    minWidth: 350,
                                    overlayClose: true,
                                    esc_close: true

                                });

                            } ).fail( function ( xhr ) {
                                    $( '#epoch-failure' ).modal({
                                        opacity:80,
                                        overlayCss: {backgroundColor:"#fff"},
                                        minWidth: 350,
                                        overlayClose: true,
                                        esc_close: true

                                    });
                            } );



                        });

                    }

                }

            );

        };

        /**
         * Get comment count
         *
         * @since 0.0.1
         *
         * @param bool updateCheck If true we are using this to check if comments have change, use false on initial load
         */
        app.comment_count = function( updateCheck ) {
            if ( 'visible' == Visibility.state() ) {
                window.clearTimeout( app.poll );
                $.get(
                    epoch_vars.api_url, {
                        action: 'comment_count',
                        epochNonce: epoch_vars.nonce,
                        postID: epoch_vars.post_id
                    } ).done( function ( response ) {
                        app.poll = setTimeout( app.comment_count, epoch_vars.epoch_options.interval );
                    } ).success( function ( response ) {
                        response = app.get_data_from_response( response );
                        if ( 'undefined' != response.count && 0 < response.count ) {
                            if ( false == updateCheck ) {
                                app.get_comments();
                                app.last_count = response.count;
                            } else {
                                if ( response.count > app.last_count ) {
                                    app.get_comments();
                                    $( '#epoch-new-comment' ).modal( {
                                        opacity: 10,
                                        overlayCss: { backgroundColor: "#fff" },
                                        minWidth: 350,
                                        overlayClose: true,
                                        esc_close: true

                                    } );
                                    app.last_count = response.count;
                                }
                            }
                        } else {
                            app.no_comments = true;
                        }
                    }
                );
            }

        };

        /**
         * Get comments
         *
         * @since 0.0.1
         */
        app.get_comments = function() {
            spinner = document.getElementById( 'comments_area_spinner_id' );
            $( spinner ).show();
            $.get(
                epoch_vars.api_url, {
                    action: 'get_comments',
                    epochNonce: epoch_vars.nonce,
                    postID: epoch_vars.post_id,
                    i: app.comments_store
                }
                ).done( function( response  ) {
                    $( spinner ).hide();


                } ).success( function( response ) {
                    response = app.get_data_from_response( response );
                    if ( 'object' == typeof response && 'undefined' != response && 'undefined' != response.comments ) {
                        comments = response.comments;
                        comments = JSON.parse( comments );
                        depth = epoch_vars;

                        size = $( comments ).size();
                        for ( i = 0; i <= size; i++ ) {

                            //parse comment
                            comment = comments[ i ];

                            app.comments_store.push( comment.comment_ID );
                            app.parse_comment( comment, false, 0 );

                            if ( 1 != depth ) {
                                //parse its children if it has them
                                parent_id = comment.comment_ID;
                                app.parse_children( comment, parent_id, 1 );
                            }

                        }

                    }

                }

            );

        };

        /**
         * Parse children of comment
         *
         * @since 0.0.4
         *
         * @param comment
         * @param parent_id
         */
        app.parse_children = function( comment, parent_id, level ) {

            if ( 'undefined' != comment.children || false != comment.children ) {

                children = comment.children;
                size = $( children ).size();

                if ( 0 != size ) {
                    for ( c = 0; c <= size; c++ ) {
                        comment = children[ c ];
                        pid = comment.comment_ID;
                        app.parse_comment( comment, parent_id, level );
                        if ( 'undefined' != comment.children || false != comment.children ) {
                            level++;
                            app.parse_children( comment, pid, level  );
                        }
                    }

                }



            }

        };

        /**
         * Utility function to get data key of responses.
         *
         * @since 0.0.1
         *
         * @param response
         * @returns {*}
         */
        app.get_data_from_response = function( response ) {
            return response.data;
        };

        /**
         * Parses content and outputs to DOM with the handlebars template
         *
         * @since 0.0.1
         *
         * @param comment
         */
        app.parse_comment = function( comment, parent_id, level ) {

            source = $( app.template_el ).html();
            template = Handlebars.compile( source );
            html = template( comment );

            if ( false == parent_id ) {
                $( html ).appendTo( app.comments_wrap_el );
            }else {
                html = '<div class="epoch-child child-of-' + parent_id +' level-' + level + ' ">' + html + '</div>';
                $( html ).appendTo( app.comments_wrap_el );

            }

            $( '.comment-reply-link' ).click( function( event ) {
                event.preventDefault;
            });
        };

        app.shutdown = function() {
            if ( true === app.comments_close && true === app.no_comments ) {
                app.shut_it_off = true;
                el = document.getElementById( epoch_vars.wrap_class );
                $( el ).hide();
            }

        }

    })( jQuery, window.Epoch || ( window.Epoch = {} ) );

} );

jQuery( function () {
    Epoch.init();

} );

