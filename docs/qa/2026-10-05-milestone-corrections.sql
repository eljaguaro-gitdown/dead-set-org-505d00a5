-- Dead Set — verified milestone corrections, 2026-10-05
--
-- Every row below passed three gates:
--   1. derived from Archive tape evidence across up to 10 tapes per night,
--      using the app's own matchScore at its real threshold of 60
--   2. re-verified per TAPE: the song appears on at least one recording whose
--      identifier is named like a real show of that date, which is what
--      rejected studio sessions, rehearsals and unknown-day items
--   3. the song's title is not satisfied by any other title in the catalog
--
-- These are "the earliest / latest night of this song that circulates", NOT
-- "first / last played". Every date here is one the player can resolve.
--
begin;
update public.songs set first_played = '1979-11-04' where title = 'Alabama Getaway' and first_played is distinct from '1979-11-04';  -- was 1979-11-01 | 7 tape(s) | gd1979-11-04.142917.sbd.miller.flac1648
update public.songs set last_played = '1995-06-02' where title = 'Alabama Getaway' and last_played is distinct from '1995-06-02';  -- was 1995-07-09 | 9 tape(s) | gd95-06-02.sbd.583.sbeok.shnf
update public.songs set last_played = '1995-06-22' where title = 'All Along the Watchtower' and last_played is distinct from '1995-06-22';  -- was 1995-07-02 | 9 tape(s) | gd95-06-22.naks.18802.sbeok.shnf
update public.songs set first_played = '1967-01-27' where title = 'Alligator' and first_played is distinct from '1967-01-27';  -- was 1967-09-29 | 2 tape(s) | gd67-01-27.aud.hanno.16744.sbeok.shnf
update public.songs set last_played = '1971-04-29' where title = 'Alligator' and last_played is distinct from '1971-04-29';  -- was 1971-10-31 | 10 tape(s) | gd71-04-29.sbd.frisco.16782.sbeok.shnf
update public.songs set last_played = '1995-07-08' where title = 'Althea' and last_played is distinct from '1995-07-08';  -- was 1995-07-09 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set first_played = '1969-12-19' where title = 'Around and Around' and first_played is distinct from '1969-12-19';  -- was 1971-07-02 | 5 tape(s) | gd69-12-19.sbd.hanno.9183.sbeok.shnf
update public.songs set last_played = '1995-07-06' where title = 'Around and Around' and last_played is distinct from '1995-07-06';  -- was 1995-07-05 | 9 tape(s) | gd95-07-06.NEWsbd.30888.sbeok.shnf_shn
update public.songs set first_played = '1966-03-12' where title = 'Beat It On Down the Line' and first_played is distinct from '1966-03-12';  -- was 1967-05-05 | 2 tape(s) | gd1966-03-12.sbd.bershaw.9516.shnf
update public.songs set last_played = '1994-10-03' where title = 'Beat It On Down the Line' and last_played is distinct from '1994-10-03';  -- was 1995-07-08 | 8 tape(s) | gd94-10-03.pmb.pujol.15112.sbeok.shnf
update public.songs set last_played = '1995-06-27' where title = 'Bertha' and last_played is distinct from '1995-06-27';  -- was 1995-07-09 | 7 tape(s) | gd95-06-27.schoeps.10180.sbeok.shnf
update public.songs set first_played = '1966-07-16' where title = 'Big Boss Man' and first_played is distinct from '1966-07-16';  -- was 1982-07-28 | 2 tape(s) | gd1966-07-16.sbd.miller.89555.sbeok.flac16
update public.songs set last_played = '1995-07-06' where title = 'Big Boss Man' and last_played is distinct from '1995-07-06';  -- was 1993-06-11 | 9 tape(s) | gd95-07-06.NEWsbd.30888.sbeok.shnf_shn
update public.songs set first_played = '1969-09-07' where title = 'Big Railroad Blues' and first_played is distinct from '1969-09-07';  -- was 1971-02-18 | 1 tape(s) | gd69-09-07.sbd.dfinney.5808.sbeok.shnf
update public.songs set last_played = '1995-06-28' where title = 'Big Railroad Blues' and last_played is distinct from '1995-06-28';  -- was 1995-07-05 | 6 tape(s) | gd95-06-28.schoeps.10154.sbeok.shnf
update public.songs set first_played = '1971-12-31' where title = 'Big River' and first_played is distinct from '1971-12-31';  -- was 1969-01-17 | 9 tape(s) | gd71-12-31.fm.lanum.135.sbeok.shnf
update public.songs set last_played = '1995-07-06' where title = 'Big River' and last_played is distinct from '1995-07-06';  -- was 1995-07-09 | 9 tape(s) | gd95-07-06.NEWsbd.30888.sbeok.shnf_shn
update public.songs set first_played = '1970-10-31' where title = 'Bird Song' and first_played is distinct from '1970-10-31';  -- was 1971-03-24 | 2 tape(s) | gd1970-10-31.153060.early.sbd.warburton.smith.sirmick.flac24
update public.songs set last_played = '1995-06-30' where title = 'Bird Song' and last_played is distinct from '1995-06-30';  -- was 1995-07-09 | 8 tape(s) | gd95-06-30.schoeps.3376.sbeok.shnf
update public.songs set first_played = '1986-12-01' where title = 'Black Muddy River' and first_played is distinct from '1986-12-01';  -- was 1986-12-15 | 2 tape(s) | gd1986-12-01.170842.sbd.miller.flac1648
update public.songs set last_played = '1995-06-22' where title = 'Black Peter' and last_played is distinct from '1995-06-22';  -- was 1995-07-09 | 9 tape(s) | gd95-06-22.naks.18802.sbeok.shnf
update public.songs set first_played = '1971-12-05' where title = 'Black-Throated Wind' and first_played is distinct from '1971-12-05';  -- was 1972-01-02 | 1 tape(s) | gd1971-12-05.147715.sbd.flegel-unknown.flac16
update public.songs set last_played = '1995-06-28' where title = 'Black-Throated Wind' and last_played is distinct from '1995-06-28';  -- was 1995-06-30 | 6 tape(s) | gd95-06-28.schoeps.10154.sbeok.shnf
update public.songs set first_played = '1985-02-18' where title = 'Blow Away' and first_played is distinct from '1985-02-18';  -- was 1989-10-08 | 1 tape(s) | gd1985-02-18.176182.sbd1.donaldson.miller.flac2496
update public.songs set last_played = '1990-07-16' where title = 'Blow Away' and last_played is distinct from '1990-07-16';  -- was 1995-07-06 | 10 tape(s) | gd90-07-16.sbd.knapp.1316.sbeok.shnf
update public.songs set first_played = '1974-06-08' where title = 'Blues for Allah' and first_played is distinct from '1974-06-08';  -- was 1975-03-23 | 1 tape(s) | gd1974-06-08.fob.sonyECM250.falanga.motb-0080.94596.flac24
update public.songs set last_played = '1991-03-31' where title = 'Blues for Allah' and last_played is distinct from '1991-03-31';  -- was 1995-04-02 | 1 tape(s) | gd91-03-31.sbd.perkins.9451.sbeok.shnf
update public.songs set first_played = '1967-11-14' where title = 'Born Cross-Eyed' and first_played is distinct from '1967-11-14';  -- was 1967-10-22 | 3 tape(s) | gd67-11-14.sbd.unknown.17417.sbefail.shnf
update public.songs set last_played = '1969-06-01' where title = 'Born Cross-Eyed' and last_played is distinct from '1969-06-01';  -- was 1968-10-20 | 1 tape(s) | gd1969-06-01.136665.sbd.sirmick.flac16
update public.songs set last_played = '1995-06-25' where title = 'Brokedown Palace' and last_played is distinct from '1995-06-25';  -- was 1995-07-09 | 10 tape(s) | gd95-06-25.sbd.2236.sbefail.shnf
update public.songs set first_played = '1971-09-30' where title = 'Brown Eyed Women' and first_played is distinct from '1971-09-30';  -- was 1971-08-23 | 1 tape(s) | gd71-09-30.sbd.cousinit.18109.sbeok.shnf
update public.songs set last_played = '1995-07-06' where title = 'Brown Eyed Women' and last_played is distinct from '1995-07-06';  -- was 1995-07-09 | 8 tape(s) | gd95-07-06.NEWsbd.30888.sbeok.shnf_shn
update public.songs set first_played = '1987-11-06' where title = 'Built to Last' and first_played is distinct from '1987-11-06';  -- was 1989-10-08 | 1 tape(s) | gd1987-11-06.AudUnk.White.Keo.116459.Flac2496
update public.songs set last_played = '1990-03-26' where title = 'Built to Last' and last_played is distinct from '1990-03-26';  -- was 1995-06-30 | 10 tape(s) | gd1990-03-26.sbd.miller.87350.sbeok.flac16
update public.songs set first_played = '1969-06-22' where title = 'Casey Jones' and first_played is distinct from '1969-06-22';  -- was 1970-06-07 | 2 tape(s) | gd69-06-22.aud.hanno.8836.sbefail.shnf
update public.songs set last_played = '1993-03-27' where title = 'Casey Jones' and last_played is distinct from '1993-03-27';  -- was 1995-07-08 | 10 tape(s) | gd93-03-27.sbd.nawrocki.31956.sbeok.shnf
update public.songs set first_played = '1968-01-17' where title = 'China Cat Sunflower' and first_played is distinct from '1968-01-17';  -- was 1968-06-14 | 3 tape(s) | gd1968-01-17.sbd.cotsman.11795.shnf
update public.songs set last_played = '1995-07-08' where title = 'China Cat Sunflower' and last_played is distinct from '1995-07-08';  -- was 1995-07-09 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set first_played = '1971-04-06' where title = 'China Doll' and first_played is distinct from '1971-04-06';  -- was 1973-02-09 | 1 tape(s) | gd1971-04-06.sbd.ifthir.smith.gems.109026.flac24
update public.songs set last_played = '1994-10-11' where title = 'China Doll' and last_played is distinct from '1994-10-11';  -- was 1995-07-08 | 10 tape(s) | gd1994-10-11.sbd.miller.34564.sbeok.flac16
update public.songs set first_played = '1966-02-25' where title = 'Cold Rain and Snow' and first_played is distinct from '1966-02-25';  -- was 1966-07-03 | 2 tape(s) | gd66-02-25.sbd.unknown.1593.sbefail.shnf
update public.songs set last_played = '1995-06-30' where title = 'Cold Rain and Snow' and last_played is distinct from '1995-06-30';  -- was 1995-07-05 | 8 tape(s) | gd95-06-30.schoeps.3376.sbeok.shnf
update public.songs set first_played = '1971-07-02' where title = 'Comes a Time' and first_played is distinct from '1971-07-02';  -- was 1971-03-24 | 1 tape(s) | gd1971-07-02.sbd.unknown.18289.flac16
update public.songs set last_played = '1994-10-09' where title = 'Comes a Time' and last_played is distinct from '1994-10-09';  -- was 1995-07-05 | 10 tape(s) | gd94-10-09.sbd.braverman.17357.sbeok.shnf
update public.songs set first_played = '1992-02-23' where title = 'Corrina' and first_played is distinct from '1992-02-23';  -- was 1992-02-22 | 7 tape(s) | gd92-02-23.schoeps.gardner.9982.sbeok.shnf
update public.songs set last_played = '1995-07-09' where title = 'Corrina' and last_played is distinct from '1995-07-09';  -- was 1995-07-08 | 10 tape(s) | gd95-07-09.sbd.7233.sbeok.shnf
update public.songs set first_played = '1968-10-08' where title = 'Cosmic Charlie' and first_played is distinct from '1968-10-08';  -- was 1968-06-14 | 2 tape(s) | gd68-10-08.sbd.belaff.17691.sbeok.shnf
update public.songs set last_played = '1976-09-25' where title = 'Cosmic Charlie' and last_played is distinct from '1976-09-25';  -- was 1976-06-19 | 4 tape(s) | gd76-09-25.sbd.aj.246.sbefail.shnf
update public.songs set first_played = '1975-02-28' where title = 'Crazy Fingers' and first_played is distinct from '1975-02-28';  -- was 1975-03-23 | 1 tape(s) | gd1975-02-28.sbd.smith.93779.sbeok.flac16
update public.songs set last_played = '1995-07-05' where title = 'Crazy Fingers' and last_played is distinct from '1995-07-05';  -- was 1995-07-09 | 8 tape(s) | gd1995-07-05.sbd.larson.35170.flac16
update public.songs set first_played = '1967-10-22' where title = 'Cryptical Envelopment' and first_played is distinct from '1967-10-22';  -- was 1968-06-14 | 2 tape(s) | gd1967-10-22.sbd.yerys.1525.shnf
update public.songs set last_played = '1985-09-03' where title = 'Cryptical Envelopment' and last_played is distinct from '1985-09-03';  -- was 1985-11-01 | 9 tape(s) | gd85-09-03.oade.sacks.7691.sbeok.shnf
update public.songs set first_played = '1969-11-15' where title = 'Cumberland Blues' and first_played is distinct from '1969-11-15';  -- was 1969-01-17 | 3 tape(s) | gd69-11-15.sbd.tiedrich.9535.sbeok.shnf
update public.songs set last_played = '1995-07-09' where title = 'Cumberland Blues' and last_played is distinct from '1995-07-09';  -- was 1995-07-02 | 10 tape(s) | gd95-07-09.sbd.7233.sbeok.shnf
update public.songs set first_played = '1966-07-01' where title = 'Dancing in the Street' and first_played is distinct from '1966-07-01';  -- was 1976-06-03 | 1 tape(s) | gd66-07-01.sbd.vernon.19924.sbeok.shnf
update public.songs set last_played = '1987-04-06' where title = 'Dancing in the Street' and last_played is distinct from '1987-04-06';  -- was 1995-06-30 | 4 tape(s) | gd87-04-06.sbd-matrix.hinko.19848.sbeok.shnf
update public.songs set first_played = '1967-11-14' where title = 'Dark Star' and first_played is distinct from '1967-11-14';  -- was 1968-02-14 | 3 tape(s) | gd67-11-14.sbd.unknown.17417.sbefail.shnf
update public.songs set last_played = '1995-06-24' where title = 'Days Between' and last_played is distinct from '1995-06-24';  -- was 1995-07-09 | 4 tape(s) | gd95-06-24.naks.12271.sbeok.shnf
update public.songs set first_played = '1971-02-19' where title = 'Deal' and first_played is distinct from '1971-02-19';  -- was 1971-02-18 | 4 tape(s) | gd71-02-19.sbd.orf.1029.sbeok.shnf
update public.songs set last_played = '1995-06-18' where title = 'Deal' and last_played is distinct from '1995-06-18';  -- was 1995-07-09 | 8 tape(s) | gd95-06-18.aud.2543.sbeok.shnf
update public.songs set first_played = '1986-03-25' where title = 'Desolation Row' and first_played is distinct from '1986-03-25';  -- was 1987-09-18 | 10 tape(s) | gd86-03-25.beyer.connor.3188.sbeok.shnf
update public.songs set last_played = '1995-07-02' where title = 'Desolation Row' and last_played is distinct from '1995-07-02';  -- was 1995-03-27 | 10 tape(s) | gd95-07-02.aud.unk.12578.sbeok.shnf
update public.songs set first_played = '1969-06-07' where title = 'Dire Wolf' and first_played is distinct from '1969-06-07';  -- was 1969-12-04 | 2 tape(s) | gd69-06-07.sbd.kaplan.9074.sbeok.shnf
update public.songs set last_played = '1995-07-02' where title = 'Dire Wolf' and last_played is distinct from '1995-07-02';  -- was 1995-07-09 | 10 tape(s) | gd95-07-02.aud.unk.12578.sbeok.shnf
update public.songs set first_played = '1969-01-24' where title = 'Duprees Diamond Blues' and first_played is distinct from '1969-01-24';  -- was 1969-02-27 | 6 tape(s) | gd69-01-24.sbd.kaplan.7922.sbeok.shnf
update public.songs set last_played = '1994-10-13' where title = 'Duprees Diamond Blues' and last_played is distinct from '1994-10-13';  -- was 1994-10-01 | 7 tape(s) | gd94-10-13.sbd.wiley.7800.sbefail.shnf
update public.songs set first_played = '1993-06-05' where title = 'Easy Answers' and first_played is distinct from '1993-06-05';  -- was 1993-03-24 | 6 tape(s) | gd93-06-05.sbd.wiley.8328.sbeok.shnf
update public.songs set first_played = '1969-08-21' where title = 'Easy Wind' and first_played is distinct from '1969-08-21';  -- was 1969-12-04 | 1 tape(s) | gd69-08-21.sbd.cotsman.13850.sbeok.shnf
update public.songs set last_played = '1971-04-04' where title = 'Easy Wind' and last_played is distinct from '1971-04-04';  -- was 1971-02-18 | 5 tape(s) | gd1971-04-04.sbd.miller.110325.flac16
update public.songs set first_played = '1970-07-11' where title = 'El Paso' and first_played is distinct from '1970-07-11';  -- was 1969-08-28 | 1 tape(s) | gd70-07-11.aud.cotsman.9379.sbefail.shnf
update public.songs set last_played = '1995-07-05' where title = 'El Paso' and last_played is distinct from '1995-07-05';  -- was 1995-07-09 | 8 tape(s) | gd1995-07-05.sbd.larson.35170.flac16
update public.songs set first_played = '1974-02-22' where title = 'Estimated Prophet' and first_played is distinct from '1974-02-22';  -- was 1977-02-26 | 2 tape(s) | gd1974-02-22.114556.sbd.miller.flac16
update public.songs set last_played = '1995-06-28' where title = 'Estimated Prophet' and last_played is distinct from '1995-06-28';  -- was 1995-07-09 | 6 tape(s) | gd95-06-28.schoeps.10154.sbeok.shnf
update public.songs set first_played = '1993-02-21' where title = 'Eternity' and first_played is distinct from '1993-02-21';  -- was 1994-10-01 | 4 tape(s) | gd93-02-21.aud.seff.1055.sbeok.shnf
update public.songs set last_played = '1995-07-08' where title = 'Eternity' and last_played is distinct from '1995-07-08';  -- was 1995-07-02 | 8 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set last_played = '1995-07-06' where title = 'Eyes of the World' and last_played is distinct from '1995-07-06';  -- was 1995-07-09 | 9 tape(s) | gd95-07-06.NEWsbd.30888.sbeok.shnf_shn
update public.songs set first_played = '1979-11-10' where title = 'Feel Like a Stranger' and first_played is distinct from '1979-11-10';  -- was 1980-04-28 | 2 tape(s) | gd1979-11-10.137649.sbd.miller.flac24
update public.songs set last_played = '1995-07-05' where title = 'Feel Like a Stranger' and last_played is distinct from '1995-07-05';  -- was 1995-07-06 | 8 tape(s) | gd1995-07-05.sbd.larson.35170.flac16
update public.songs set first_played = '1971-08-21' where title = 'Fire on the Mountain' and first_played is distinct from '1971-08-21';  -- was 1977-03-18 | 1 tape(s) | gd1971-08-21.aud.38f.83307.sbeok.flac16
update public.songs set last_played = '1995-07-02' where title = 'Fire on the Mountain' and last_played is distinct from '1995-07-02';  -- was 1995-07-09 | 10 tape(s) | gd95-07-02.aud.unk.12578.sbeok.shnf
update public.songs set first_played = '1988-06-19' where title = 'Foolish Heart' and first_played is distinct from '1988-06-19';  -- was 1989-02-06 | 10 tape(s) | gd88-06-19.sennheiser.ladner.17267.sbeok.shnf
update public.songs set last_played = '1995-06-27' where title = 'Foolish Heart' and last_played is distinct from '1995-06-27';  -- was 1995-07-06 | 7 tape(s) | gd95-06-27.schoeps.10180.sbeok.shnf
update public.songs set first_played = '1975-06-04' where title = 'Franklin''s Tower' and first_played is distinct from '1975-06-04';  -- was 1975-06-17 | 1 tape(s) | gd1975-06-04.145777.sbd.pcm.dalton.miller.noel.flac16
update public.songs set last_played = '1995-06-22' where title = 'Franklin''s Tower' and last_played is distinct from '1995-06-22';  -- was 1995-07-09 | 9 tape(s) | gd95-06-22.naks.18802.sbeok.shnf
update public.songs set last_played = '1995-06-24' where title = 'Friend of the Devil' and last_played is distinct from '1995-06-24';  -- was 1995-07-09 | 4 tape(s) | gd95-06-24.naks.12271.sbeok.shnf
update public.songs set first_played = '1970-05-24' where title = 'Going Down the Road Feeling Bad' and first_played is distinct from '1970-05-24';  -- was 1970-06-24 | 1 tape(s) | gd1970-05-24.136669.sbd.sirmick.flac1648
update public.songs set last_played = '1995-07-05' where title = 'Going Down the Road Feeling Bad' and last_played is distinct from '1995-07-05';  -- was 1995-07-09 | 6 tape(s) | gd1995-07-05.sbd.larson.35170.flac16
update public.songs set first_played = '1966-05-19' where title = 'Good Lovin' and first_played is distinct from '1966-05-19';  -- was 1966-07-03 | 4 tape(s) | gd66-05-19.sbd.lestatkat.6516.sbeok.shnf
update public.songs set last_played = '1995-06-28' where title = 'Good Lovin' and last_played is distinct from '1995-06-28';  -- was 1995-07-09 | 6 tape(s) | gd95-06-28.schoeps.10154.sbeok.shnf
update public.songs set first_played = '1970-10-30' where title = 'Greatest Story Ever Told' and first_played is distinct from '1970-10-30';  -- was 1971-02-18 | 3 tape(s) | gd1970-10-30.153206.sbd.warburton.smith.sirmick.flac24
update public.songs set last_played = '1995-06-27' where title = 'Greatest Story Ever Told' and last_played is distinct from '1995-06-27';  -- was 1995-07-05 | 7 tape(s) | gd95-06-27.schoeps.10180.sbeok.shnf
update public.songs set first_played = '1969-03-15' where title = 'Hard to Handle' and first_played is distinct from '1969-03-15';  -- was 1969-02-27 | 4 tape(s) | gd69-03-15.sbd.cotsman.4280.sbeok.shnf
update public.songs set last_played = '1982-12-31' where title = 'Hard to Handle' and last_played is distinct from '1982-12-31';  -- was 1990-03-29 | 10 tape(s) | gd82-12-31.sbd.bode.5958.sbeok.shnf
update public.songs set first_played = '1972-04-17' where title = 'He''s Gone' and first_played is distinct from '1972-04-17';  -- was 1972-08-27 | 6 tape(s) | gd1972-04-17.sbd.ashley-field.34032.sbeok.flac16
update public.songs set last_played = '1995-07-06' where title = 'He''s Gone' and last_played is distinct from '1995-07-06';  -- was 1995-07-09 | 9 tape(s) | gd95-07-06.NEWsbd.30888.sbeok.shnf_shn
update public.songs set first_played = '1983-01-24' where title = 'Hell in a Bucket' and first_played is distinct from '1983-01-24';  -- was 1983-10-15 | 1 tape(s) | gd83-01-24.sbd.miller.21264.sbeok.shnf
update public.songs set last_played = '1995-06-30' where title = 'Hell in a Bucket' and last_played is distinct from '1995-06-30';  -- was 1995-07-09 | 8 tape(s) | gd95-06-30.schoeps.3376.sbeok.shnf
update public.songs set first_played = '1975-03-01' where title = 'Help on the Way' and first_played is distinct from '1975-03-01';  -- was 1975-06-17 | 1 tape(s) | gd1975-03-01.145786.sbd.gans.miller.noel.flac1644
update public.songs set last_played = '1995-06-22' where title = 'Help on the Way' and last_played is distinct from '1995-06-22';  -- was 1995-07-09 | 9 tape(s) | gd95-06-22.naks.18802.sbeok.shnf
update public.songs set last_played = '1995-07-02' where title = 'Here Comes Sunshine' and last_played is distinct from '1995-07-02';  -- was 1974-10-18 | 10 tape(s) | gd95-07-02.aud.unk.12578.sbeok.shnf
update public.songs set first_played = '1969-06-21' where title = 'High Time' and first_played is distinct from '1969-06-21';  -- was 1969-11-07 | 3 tape(s) | gd69-06-21.early-late.aud-sbd.cotsman.16334.sbeok.shnf
update public.songs set last_played = '1995-03-24' where title = 'High Time' and last_played is distinct from '1995-03-24';  -- was 1985-06-30 | 4 tape(s) | gd95-03-24.akg.5668.sbeok.shnf
update public.songs set first_played = '1965-11-03' where title = 'I Know You Rider' and first_played is distinct from '1965-11-03';  -- was 1966-12-01 | 1 tape(s) | gd65-11-03.sbd.vernon.9044.sbeok.shnf
update public.songs set last_played = '1995-07-08' where title = 'I Know You Rider' and last_played is distinct from '1995-07-08';  -- was 1995-07-09 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set first_played = '1978-08-18' where title = 'I Need a Miracle' and first_played is distinct from '1978-08-18';  -- was 1978-01-06 | 1 tape(s) | gd78-08-18.sbd.tzuriel.11504.sbeok.shnf
update public.songs set last_played = '1995-06-30' where title = 'I Need a Miracle' and last_played is distinct from '1995-06-30';  -- was 1995-07-08 | 8 tape(s) | gd95-06-30.schoeps.3376.sbeok.shnf
update public.songs set last_played = '1994-10-17' where title = 'In the Midnight Hour' and last_played is distinct from '1994-10-17';  -- was 1984-04-14 | 8 tape(s) | gd94-10-17.sbd.carr.14615.sbeok.shnf
update public.songs set first_played = '1969-05-10' where title = 'It Must Have Been the Roses' and first_played is distinct from '1969-05-10';  -- was 1972-01-02 | 1 tape(s) | gd69-05-10.sbd.tzuriel.1336.sbeok.shnf
update public.songs set last_played = '1995-06-22' where title = 'It Must Have Been the Roses' and last_played is distinct from '1995-06-22';  -- was 1995-07-08 | 9 tape(s) | gd95-06-22.naks.18802.sbeok.shnf
update public.songs set first_played = '1970-10-30' where title = 'Jack Straw' and first_played is distinct from '1970-10-30';  -- was 1971-10-19 | 3 tape(s) | gd1970-10-30.153206.sbd.warburton.smith.sirmick.flac24
update public.songs set last_played = '1995-07-08' where title = 'Jack Straw' and last_played is distinct from '1995-07-08';  -- was 1995-07-09 | 9 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set first_played = '1970-12-31' where title = 'Johnny B. Goode' and first_played is distinct from '1970-12-31';  -- was 1976-06-03 | 1 tape(s) | gd70-12-31.aftershow.sbd.cole.6171.sbeok.shnf
update public.songs set last_played = '1995-04-05' where title = 'Johnny B. Goode' and last_played is distinct from '1995-04-05';  -- was 1995-07-09 | 4 tape(s) | gd95-04-05.schoeps.10385.sbeok.shnf
update public.songs set first_played = '1974-06-08' where title = 'Just Like Tom Thumbs Blues' and first_played is distinct from '1974-06-08';  -- was 1982-04-06 | 1 tape(s) | gd1974-06-08.fob.sonyECM250.falanga.motb-0080.94596.flac24
update public.songs set last_played = '1995-06-28' where title = 'Just Like Tom Thumbs Blues' and last_played is distinct from '1995-06-28';  -- was 1995-07-08 | 3 tape(s) | gd95-06-28.schoeps.10154.sbeok.shnf
update public.songs set first_played = '1989-02-07' where title = 'Just a Little Light' and first_played is distinct from '1989-02-07';  -- was 1989-02-06 | 7 tape(s) | gd89-02-07.sbd.wiley.9202.sbeok.shnf
update public.songs set last_played = '1990-07-21' where title = 'Just a Little Light' and last_played is distinct from '1990-07-21';  -- was 1995-06-24 | 10 tape(s) | gd90-07-21.sbd.conner.7832.sbeok.shnf
update public.songs set first_played = '1982-08-28' where title = 'Keep Your Day Job' and first_played is distinct from '1982-08-28';  -- was 1982-04-06 | 9 tape(s) | gd82-08-28.sbd.lai.2333.sbefail.shnf
update public.songs set last_played = '1986-04-04' where title = 'Keep Your Day Job' and last_played is distinct from '1986-04-04';  -- was 1984-07-15 | 9 tape(s) | gd86-04-04.aud.eD.13464.sbeok.shnf
update public.songs set first_played = '1978-11-17' where title = 'Knockin on Heavens Door' and first_played is distinct from '1978-11-17';  -- was 1987-07-04 | 4 tape(s) | gd78-11-17.acoustic.sbd.dodd.7687.sbeok.shnf
update public.songs set last_played = '1994-07-23' where title = 'Knockin on Heavens Door' and last_played is distinct from '1994-07-23';  -- was 1995-07-09 | 4 tape(s) | gd1994-07-23.sbd.burns.14853.sbeok.flac16
update public.songs set first_played = '1970-11-11' where title = 'La Bamba' and first_played is distinct from '1970-11-11';  -- was 1984-03-31 | 4 tape(s) | gd70-11-11.aud.cotsman.17081.sbeok.shnf
update public.songs set last_played = '1987-09-23' where title = 'La Bamba' and last_played is distinct from '1987-09-23';  -- was 1994-12-16 | 10 tape(s) | gd87-09-23.sbd.willy.15207.sbeok.shnf
update public.songs set first_played = '1993-09-29' where title = 'Lady with a Fan' and first_played is distinct from '1993-09-29';  -- was 1977-02-26 | 1 tape(s) | gd93-09-29.schoeps.pujol.12436.sbeok.shnf
update public.songs set last_played = '1993-09-29' where title = 'Lady with a Fan' and last_played is distinct from '1993-09-29';  -- was 1995-03-24 | 1 tape(s) | gd93-09-29.schoeps.pujol.12436.sbeok.shnf
update public.songs set first_played = '1975-03-01' where title = 'Lazy Lightning' and first_played is distinct from '1975-03-01';  -- was 1976-06-03 | 1 tape(s) | gd1975-03-01.145786.sbd.gans.miller.noel.flac1644
update public.songs set last_played = '1989-04-15' where title = 'Lazy Lightning' and last_played is distinct from '1989-04-15';  -- was 1995-07-01 | 1 tape(s) | gd1989-04-15.AKG451.Darby.118401.Flac1644
update public.songs set first_played = '1993-02-21' where title = 'Lazy River Road' and first_played is distinct from '1993-02-21';  -- was 1993-02-22 | 4 tape(s) | gd93-02-21.aud.seff.1055.sbeok.shnf
update public.songs set last_played = '1995-07-09' where title = 'Lazy River Road' and last_played is distinct from '1995-07-09';  -- was 1995-07-08 | 10 tape(s) | gd95-07-09.sbd.7233.sbeok.shnf
update public.songs set last_played = '1995-07-02' where title = 'Let It Grow' and last_played is distinct from '1995-07-02';  -- was 1995-07-09 | 10 tape(s) | gd95-07-02.aud.unk.12578.sbeok.shnf
update public.songs set first_played = '1993-02-21' where title = 'Liberty' and first_played is distinct from '1993-02-21';  -- was 1993-02-22 | 4 tape(s) | gd93-02-21.aud.seff.1055.sbeok.shnf
update public.songs set first_played = '1980-08-19' where title = 'Little Red Rooster' and first_played is distinct from '1980-08-19';  -- was 1966-07-03 | 6 tape(s) | gd1980-08-19.sbd.miller.88172.sbeok.flac16
update public.songs set last_played = '1995-07-09' where title = 'Little Red Rooster' and last_played is distinct from '1995-07-09';  -- was 1995-07-02 | 10 tape(s) | gd95-07-09.sbd.7233.sbeok.shnf
update public.songs set first_played = '1972-03-21' where title = 'Looks Like Rain' and first_played is distinct from '1972-03-21';  -- was 1972-01-02 | 2 tape(s) | gd1972-03-21.sbd.miller.92395.sbeok.flac16
update public.songs set last_played = '1995-06-30' where title = 'Looks Like Rain' and last_played is distinct from '1995-06-30';  -- was 1995-07-05 | 8 tape(s) | gd95-06-30.schoeps.3376.sbeok.shnf
update public.songs set first_played = '1973-02-09' where title = 'Loose Lucy' and first_played is distinct from '1973-02-09';  -- was 1974-02-22 | 8 tape(s) | gd73-02-09.sbd.bertha-fink.14939.sbeok.shnf
update public.songs set last_played = '1995-07-05' where title = 'Loose Lucy' and last_played is distinct from '1995-07-05';  -- was 1995-07-02 | 8 tape(s) | gd1995-07-05.sbd.larson.35170.flac16
update public.songs set last_played = '1995-06-28' where title = 'Loser' and last_played is distinct from '1995-06-28';  -- was 1995-07-09 | 6 tape(s) | gd95-06-28.schoeps.10154.sbeok.shnf
update public.songs set first_played = '1979-08-04' where title = 'Lost Sailor' and first_played is distinct from '1979-08-04';  -- was 1980-04-28 | 9 tape(s) | gd79-08-04.sbd.munder.9578.sbeok.shnf
update public.songs set last_played = '1991-10-04' where title = 'Lost Sailor' and last_played is distinct from '1991-10-04';  -- was 1995-07-06 | 2 tape(s) | gd1991-10-04.151511.sbd.hance.sirmick.fixed-retracked.flac16
update public.songs set first_played = '1969-06-11' where title = 'Mama Tried' and first_played is distinct from '1969-06-11';  -- was 1969-01-17 | 1 tape(s) | gd1969-06-11.145953.aud.flac1644
update public.songs set last_played = '1995-06-25' where title = 'Mama Tried' and last_played is distinct from '1995-06-25';  -- was 1995-07-08 | 10 tape(s) | gd95-06-25.sbd.2236.sbefail.shnf
update public.songs set first_played = '1981-07-02' where title = 'Man Smart Woman Smarter' and first_played is distinct from '1981-07-02';  -- was 1986-03-19 | 4 tape(s) | gd81-07-02.senn421.munder.9828.sbeok.shnf
update public.songs set last_played = '1995-06-21' where title = 'Man Smart Woman Smarter' and last_played is distinct from '1995-06-21';  -- was 1995-06-25 | 4 tape(s) | gd95-06-21.naks.5971.sbeok.shnf
update public.songs set first_played = '1969-12-19' where title = 'Mason''s Children' and first_played is distinct from '1969-12-19';  -- was 1969-12-04 | 5 tape(s) | gd69-12-19.sbd.hanno.9183.sbeok.shnf
update public.songs set last_played = '1970-04-12' where title = 'Mason''s Children' and last_played is distinct from '1970-04-12';  -- was 1970-05-02 | 1 tape(s) | gd1970-04-12.149.50th.anniv.radiobroadcast.91.3FM.KXCI.flac1644
update public.songs set first_played = '1966-11-29' where title = 'Me and My Uncle' and first_played is distinct from '1966-11-29';  -- was 1966-06-11 | 5 tape(s) | gd66-11-29.sbd.ret.20448.sbeok.shnf
update public.songs set last_played = '1995-07-06' where title = 'Me and My Uncle' and last_played is distinct from '1995-07-06';  -- was 1995-07-09 | 9 tape(s) | gd95-07-06.NEWsbd.30888.sbeok.shnf_shn
update public.songs set first_played = '1971-09-29' where title = 'Mexicali Blues' and first_played is distinct from '1971-09-29';  -- was 1971-10-19 | 1 tape(s) | gd71-09-29.sbd.cousinit.16891.sbeok.shnf
update public.songs set last_played = '1995-06-25' where title = 'Mexicali Blues' and last_played is distinct from '1995-06-25';  -- was 1995-07-05 | 10 tape(s) | gd95-06-25.sbd.2236.sbefail.shnf
update public.songs set last_played = '1994-03-23' where title = 'Might as Well' and last_played is distinct from '1994-03-23';  -- was 1995-07-09 | 7 tape(s) | gd94-03-23.sbd-aud.herman.13793.sbeok.shnf
update public.songs set first_played = '1976-06-04' where title = 'Mission in the Rain' and first_played is distinct from '1976-06-04';  -- was 1976-06-03 | 6 tape(s) | gd76-06-04.sbd.cotsman.9797.sbeok.shnf
update public.songs set last_played = '1995-06-30' where title = 'Mission in the Rain' and last_played is distinct from '1995-06-30';  -- was 1977-11-06 | 8 tape(s) | gd95-06-30.schoeps.3376.sbeok.shnf
update public.songs set first_played = '1972-07-16' where title = 'Mississippi Half-Step' and first_played is distinct from '1972-07-16';  -- was 1972-08-27 | 2 tape(s) | gd72-07-16.sbd-aud.cotsman.11258.sbeok.shnf
update public.songs set first_played = '1967-01-14' where title = 'Morning Dew' and first_played is distinct from '1967-01-14';  -- was 1966-07-03 | 1 tape(s) | gd67-01-14.sbd.vernon.9108.sbeok.shnf
update public.songs set last_played = '1995-06-21' where title = 'Morning Dew' and last_played is distinct from '1995-06-21';  -- was 1995-07-09 | 9 tape(s) | gd95-06-21.naks.5971.sbeok.shnf
update public.songs set first_played = '1971-07-31' where title = 'Mr. Charlie' and first_played is distinct from '1971-07-31';  -- was 1972-01-02 | 2 tape(s) | gd1971-07-31.132730.sbd.miller.flac16
update public.songs set last_played = '1972-05-26' where title = 'Mr. Charlie' and last_played is distinct from '1972-05-26';  -- was 1974-06-30 | 4 tape(s) | gd72-05-26.sbd.hollister.12758.sbeok.shnf
update public.songs set first_played = '1983-03-14' where title = 'My Brother Esau' and first_played is distinct from '1983-03-14';  -- was 1983-10-15 | 1 tape(s) | gd83-03-14.sbd.miller.21269.sbeok.shnf
update public.songs set last_played = '1987-10-03' where title = 'My Brother Esau' and last_played is distinct from '1987-10-03';  -- was 1987-09-18 | 10 tape(s) | gd87-10-03.sbd.bertha-ashley.7368.sbeok.shnf
update public.songs set first_played = '1967-01-27' where title = 'New Potato Caboose' and first_played is distinct from '1967-01-27';  -- was 1967-09-29 | 2 tape(s) | gd67-01-27.aud.hanno.16744.sbeok.shnf
update public.songs set last_played = '1969-06-08' where title = 'New Potato Caboose' and last_played is distinct from '1969-06-08';  -- was 1968-10-20 | 3 tape(s) | gd69-06-08.sbd.cotsman.19285.sbeok.shnf
update public.songs set first_played = '1969-12-20' where title = 'New Speedway Boogie' and first_played is distinct from '1969-12-20';  -- was 1970-01-16 | 1 tape(s) | gd69-12-20.sbd.cotsman.6301.sbefail.shnf
update public.songs set last_played = '1995-07-02' where title = 'New Speedway Boogie' and last_played is distinct from '1995-07-02';  -- was 1994-12-16 | 10 tape(s) | gd95-07-02.aud.unk.12578.sbeok.shnf
update public.songs set first_played = '1966-02-25' where title = 'Next Time You See Me' and first_played is distinct from '1966-02-25';  -- was 1966-07-03 | 2 tape(s) | gd66-02-25.sbd.unknown.1593.sbefail.shnf
update public.songs set last_played = '1972-05-26' where title = 'Next Time You See Me' and last_played is distinct from '1972-05-26';  -- was 1973-02-15 | 4 tape(s) | gd72-05-26.sbd.hollister.12758.sbeok.shnf
update public.songs set first_played = '1966-07-16' where title = 'Nobody''s Fault But Mine' and first_played is distinct from '1966-07-16';  -- was 1981-03-09 | 2 tape(s) | gd1966-07-16.sbd.miller.89555.sbeok.flac16
update public.songs set last_played = '1994-12-19' where title = 'Nobody''s Fault But Mine' and last_played is distinct from '1994-12-19';  -- was 1989-12-27 | 2 tape(s) | gd94-12-19.sbd.vernon.20712.sbeok.shnf
update public.songs set first_played = '1969-02-19' where title = 'Not Fade Away' and first_played is distinct from '1969-02-19';  -- was 1966-07-03 | 1 tape(s) | gd69-02-19.sbd.cotsman.4511.sbeok.shnf
update public.songs set last_played = '1995-07-05' where title = 'Not Fade Away' and last_played is distinct from '1995-07-05';  -- was 1995-07-09 | 8 tape(s) | gd1995-07-05.sbd.larson.35170.flac16
update public.songs set last_played = '1995-07-08' where title = 'One More Saturday Night' and last_played is distinct from '1995-07-08';  -- was 1995-07-09 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set last_played = '1995-07-05' where title = 'Peggy-O' and last_played is distinct from '1995-07-05';  -- was 1995-07-06 | 8 tape(s) | gd1995-07-05.sbd.larson.35170.flac16
update public.songs set first_played = '1989-04-28' where title = 'Picasso Moon' and first_played is distinct from '1989-04-28';  -- was 1989-07-04 | 8 tape(s) | gd1989-04-28.sbd.miller.88099.sbeok.flac16
update public.songs set last_played = '1995-06-25' where title = 'Picasso Moon' and last_played is distinct from '1995-06-25';  -- was 1995-06-22 | 10 tape(s) | gd95-06-25.sbd.2236.sbefail.shnf
update public.songs set first_played = '1971-05-29' where title = 'Promised Land' and first_played is distinct from '1971-05-29';  -- was 1971-02-18 | 1 tape(s) | gd71-05-29.aud.cotsman.19153.sbeok.shnf
update public.songs set last_played = '1995-07-08' where title = 'Queen Jane Approximately' and last_played is distinct from '1995-07-08';  -- was 1993-06-11 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set last_played = '1995-06-27' where title = 'Ramble On Rose' and last_played is distinct from '1995-06-27';  -- was 1995-07-09 | 7 tape(s) | gd95-06-27.schoeps.10180.sbeok.shnf
update public.songs set first_played = '1991-03-17' where title = 'Reuben and Cherise' and first_played is distinct from '1991-03-17';  -- was 1991-09-10 | 2 tape(s) | gd91-03-17.sbd.munder.8745.sbeok.shnf
update public.songs set last_played = '1991-06-09' where title = 'Reuben and Cherise' and last_played is distinct from '1991-06-09';  -- was 1995-06-30 | 8 tape(s) | gd91-06-09.sbd.unknown.12756.sbeok.shnf
update public.songs set last_played = '1989-09-27' where title = 'Ripple' and last_played is distinct from '1989-09-27';  -- was 1990-07-14 | 1 tape(s) | gd1989-09-27.145209.s1.aud.flac1644
update public.songs set first_played = '1968-12-07' where title = 'Rosemary' and first_played is distinct from '1968-12-07';  -- was 1969-01-17 | 3 tape(s) | gd68-12-07.sbd.naines.16944.sbeok.shnf
update public.songs set last_played = '1995-06-21' where title = 'Row Jimmy' and last_played is distinct from '1995-06-21';  -- was 1995-07-02 | 9 tape(s) | gd95-06-21.naks.5971.sbeok.shnf
update public.songs set first_played = '1979-08-31' where title = 'Saint of Circumstance' and first_played is distinct from '1979-08-31';  -- was 1980-04-28 | 3 tape(s) | gd1979-08-31.sbd.miller.92924.sbeok.flac16
update public.songs set last_played = '1995-07-08' where title = 'Saint of Circumstance' and last_played is distinct from '1995-07-08';  -- was 1995-07-06 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set first_played = '1992-12-02' where title = 'Samba in the Rain' and first_played is distinct from '1992-12-02';  -- was 1993-09-14 | 9 tape(s) | gd92-12-02.aud.ststephen.12228.sbefail.shnf
update public.songs set last_played = '1995-07-09' where title = 'Samba in the Rain' and last_played is distinct from '1995-07-09';  -- was 1995-07-05 | 10 tape(s) | gd95-07-09.sbd.7233.sbeok.shnf
update public.songs set first_played = '1980-11-26' where title = 'Satisfaction' and first_played is distinct from '1980-11-26';  -- was 1966-07-03 | 9 tape(s) | gd80-11-26.sbd.clugston.3380.sbeok.shnf
update public.songs set last_played = '1994-08-01' where title = 'Satisfaction' and last_played is distinct from '1994-08-01';  -- was 1978-07-08 | 4 tape(s) | gd94-08-01.neumann.nawrocki.12522.sbeok.shnf
update public.songs set first_played = '1973-10-30' where title = 'Scarlet Begonias' and first_played is distinct from '1973-10-30';  -- was 1974-03-23 | 2 tape(s) | gd1973-10-30.170338.aud.lamarre.vernon.sirmick.flac1644
update public.songs set last_played = '1995-07-02' where title = 'Scarlet Begonias' and last_played is distinct from '1995-07-02';  -- was 1995-07-09 | 10 tape(s) | gd95-07-02.aud.unk.12578.sbeok.shnf
update public.songs set first_played = '1978-08-18' where title = 'Shakedown Street' and first_played is distinct from '1978-08-18';  -- was 1978-08-31 | 1 tape(s) | gd78-08-18.sbd.tzuriel.11504.sbeok.shnf
update public.songs set first_played = '1985-04-04' where title = 'She Belongs to Me' and first_played is distinct from '1985-04-04';  -- was 1987-09-18 | 9 tape(s) | gd85-04-04.oade-schoeps.sacks.23848.sbeok.flacf
update public.songs set last_played = '1985-11-21' where title = 'She Belongs to Me' and last_played is distinct from '1985-11-21';  -- was 1993-06-11 | 9 tape(s) | gd85-11-21.sbd.lai.3351.sbefail.shnf
update public.songs set last_played = '1995-06-25' where title = 'Ship of Fools' and last_played is distinct from '1995-06-25';  -- was 1995-07-09 | 10 tape(s) | gd95-06-25.sbd.2236.sbefail.shnf
update public.songs set first_played = '1974-06-20' where title = 'Slipknot!' and first_played is distinct from '1974-06-20';  -- was 1975-06-17 | 2 tape(s) | gd74-06-20.sbd.clugston.2179.sbeok.shnf
update public.songs set last_played = '1995-06-22' where title = 'Slipknot!' and last_played is distinct from '1995-06-22';  -- was 1995-07-09 | 9 tape(s) | gd95-06-22.naks.18802.sbeok.shnf
update public.songs set first_played = '1992-02-21' where title = 'So Many Roads' and first_played is distinct from '1992-02-21';  -- was 1992-02-22 | 1 tape(s) | gd92-02-21.smr-rehersal.8189.sbeok.shnf
update public.songs set first_played = '1968-01-23' where title = 'St. Stephen' and first_played is distinct from '1968-01-23';  -- was 1968-06-14 | 1 tape(s) | gd1968-01-23.sbd.finney.4528.shnf
update public.songs set last_played = '1994-10-01' where title = 'St. Stephen' and last_played is distinct from '1994-10-01';  -- was 1995-07-09 | 1 tape(s) | gd94-10-01.pmb.pujol.15079.sbeok.shnf
update public.songs set first_played = '1978-08-18' where title = 'Stagger Lee' and first_played is distinct from '1978-08-18';  -- was 1978-01-06 | 1 tape(s) | gd78-08-18.sbd.tzuriel.11504.sbeok.shnf
update public.songs set last_played = '1995-06-18' where title = 'Stagger Lee' and last_played is distinct from '1995-06-18';  -- was 1995-07-05 | 8 tape(s) | gd95-06-18.aud.2543.sbeok.shnf
update public.songs set first_played = '1988-08-28' where title = 'Standing on the Moon' and first_played is distinct from '1988-08-28';  -- was 1989-02-06 | 1 tape(s) | gd1988-08-28.163899.ultramatrix.miller.flac2496
update public.songs set last_played = '1995-06-30' where title = 'Standing on the Moon' and last_played is distinct from '1995-06-30';  -- was 1995-07-09 | 8 tape(s) | gd95-06-30.schoeps.3376.sbeok.shnf
update public.songs set first_played = '1972-06-17' where title = 'Stella Blue' and first_played is distinct from '1972-06-17';  -- was 1973-02-09 | 3 tape(s) | gd1972-06-17.shure.melton.miller.116272.flac16
update public.songs set last_played = '1995-07-06' where title = 'Stella Blue' and last_played is distinct from '1995-07-06';  -- was 1995-07-09 | 9 tape(s) | gd95-07-06.NEWsbd.30888.sbeok.shnf_shn
update public.songs set last_played = '1995-07-08' where title = 'Sugaree' and last_played is distinct from '1995-07-08';  -- was 1995-07-09 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set first_played = '1971-04-07' where title = 'Sunshine Daydream' and first_played is distinct from '1971-04-07';  -- was 1972-01-02 | 1 tape(s) | gd1971-04-07.136892.sbd.GEMS.flac16
update public.songs set last_played = '1995-05-29' where title = 'Sunshine Daydream' and last_played is distinct from '1995-05-29';  -- was 1995-07-08 | 1 tape(s) | gd1995-05-29.pzm.russjcan.92059.sbeok.flac16
update public.songs set first_played = '1975-04-02' where title = 'Supplication' and first_played is distinct from '1975-04-02';  -- was 1976-06-03 | 1 tape(s) | gd75-04-02.sbd.backus.14290.sbeok.shnf
update public.songs set last_played = '1995-06-21' where title = 'Supplication' and last_played is distinct from '1995-06-21';  -- was 1995-07-01 | 5 tape(s) | gd95-06-21.naks.5971.sbeok.shnf
update public.songs set first_played = '1971-09-30' where title = 'Tennessee Jed' and first_played is distinct from '1971-09-30';  -- was 1971-10-19 | 1 tape(s) | gd71-09-30.sbd.cousinit.18109.sbeok.shnf
update public.songs set last_played = '1995-07-08' where title = 'Tennessee Jed' and last_played is distinct from '1995-07-08';  -- was 1995-07-09 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set last_played = '1995-07-08' where title = 'Terrapin Station' and last_played is distinct from '1995-07-08';  -- was 1995-07-09 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set last_played = '1982-08-06' where title = 'The Eleven' and last_played is distinct from '1982-08-06';  -- was 1974-06-30 | 1 tape(s) | gd1982-08-06.mtx.seamons.ht58.125889.flac16
update public.songs set first_played = '1967-03-18' where title = 'The Golden Road' and first_played is distinct from '1967-03-18';  -- was 1967-01-14 | 3 tape(s) | gd67-03-18.sbd.fink.10282.sbeok.shnf
update public.songs set last_played = '1967-05-05' where title = 'The Golden Road' and last_played is distinct from '1967-05-05';  -- was 1991-09-10 | 3 tape(s) | gd67-05-05.sbs.yerys.1595.sbeok.shnf
update public.songs set first_played = '1975-02-28' where title = 'The Music Never Stopped' and first_played is distinct from '1975-02-28';  -- was 1975-06-17 | 1 tape(s) | gd1975-02-28.sbd.smith.93779.sbeok.flac16
update public.songs set last_played = '1995-06-28' where title = 'The Music Never Stopped' and last_played is distinct from '1995-06-28';  -- was 1995-07-09 | 6 tape(s) | gd95-06-28.schoeps.10154.sbeok.shnf
update public.songs set first_played = '1967-08-05' where title = 'The Other One' and first_played is distinct from '1967-08-05';  -- was 1967-11-10 | 3 tape(s) | gd1967-08-05.169430.sbd.flegel.flac1648
update public.songs set last_played = '1995-07-08' where title = 'The Other One' and last_played is distinct from '1995-07-08';  -- was 1995-07-09 | 10 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set first_played = '1966-01-08' where title = 'The Race Is On' and first_played is distinct from '1966-01-08';  -- was 1986-03-19 | 1 tape(s) | gd1966-01-08.sbd.lestatkatt.106505.flac16
update public.songs set last_played = '1995-05-20' where title = 'The Race Is On' and last_played is distinct from '1995-05-20';  -- was 1993-09-22 | 5 tape(s) | gd95-05-20.akg.18798.sbeok.shnf
update public.songs set first_played = '1976-05-28' where title = 'The Wheel' and first_played is distinct from '1976-05-28';  -- was 1972-01-02 | 1 tape(s) | gd76-05-2x.sbd.vernon.9769.sbeok.shnf
update public.songs set last_played = '1995-05-25' where title = 'The Wheel' and last_played is distinct from '1995-05-25';  -- was 1995-07-09 | 7 tape(s) | gd95-05-25.neumann.18801.sbeok.shnf
update public.songs set last_played = '1994-09-27' where title = 'They Love Each Other' and last_played is distinct from '1994-09-27';  -- was 1995-07-05 | 6 tape(s) | gd94-09-27.pnb.pujol.14021.sbeok.shnf
update public.songs set first_played = '1981-11-11' where title = 'Throwing Stones' and first_played is distinct from '1981-11-11';  -- was 1982-09-11 | 1 tape(s) | gd1981-11-11.149798.akg224.dyche.flac1644
update public.songs set last_played = '1995-07-05' where title = 'Throwing Stones' and last_played is distinct from '1995-07-05';  -- was 1995-07-09 | 8 tape(s) | gd1995-07-05.sbd.larson.35170.flac16
update public.songs set first_played = '1970-07-30' where title = 'To Lay Me Down' and first_played is distinct from '1970-07-30';  -- was 1970-09-17 | 2 tape(s) | gd70-07-30.sbd.cotsman.17077.sbeok.shnf
update public.songs set last_played = '1992-06-28' where title = 'To Lay Me Down' and last_played is distinct from '1992-06-28';  -- was 1995-06-22 | 10 tape(s) | gd92-06-28.sbd.braverman.8601.sbeok.shnf
update public.songs set first_played = '1984-12-28' where title = 'Tons of Steel' and first_played is distinct from '1984-12-28';  -- was 1985-09-02 | 8 tape(s) | gd84-12-28.aud.unknown.16584.sbeok.shnf
update public.songs set last_played = '1987-09-23' where title = 'Tons of Steel' and last_played is distinct from '1987-09-23';  -- was 1988-07-17 | 10 tape(s) | gd87-09-23.sbd.willy.15207.sbeok.shnf
update public.songs set first_played = '1969-05-10' where title = 'Truckin''' and first_played is distinct from '1969-05-10';  -- was 1970-08-18 | 1 tape(s) | gd69-05-10.sbd.tzuriel.1336.sbeok.shnf
update public.songs set last_played = '1995-07-06' where title = 'Truckin''' and last_played is distinct from '1995-07-06';  -- was 1995-07-09 | 9 tape(s) | gd95-07-06.NEWsbd.30888.sbeok.shnf_shn
update public.songs set last_played = '1995-07-09' where title = 'Unbroken Chain' and last_played is distinct from '1995-07-09';  -- was 1995-07-06 | 10 tape(s) | gd95-07-09.sbd.7233.sbeok.shnf
update public.songs set first_played = '1969-05-10' where title = 'Uncle John''s Band' and first_played is distinct from '1969-05-10';  -- was 1969-09-01 | 1 tape(s) | gd69-05-10.sbd.tzuriel.1336.sbeok.shnf
update public.songs set last_played = '1995-06-28' where title = 'Uncle John''s Band' and last_played is distinct from '1995-06-28';  -- was 1995-07-09 | 6 tape(s) | gd95-06-28.schoeps.10154.sbeok.shnf
update public.songs set first_played = '1988-06-01' where title = 'Victim or the Crime' and first_played is distinct from '1988-06-01';  -- was 1989-07-04 | 1 tape(s) | gd88-06-01.sbd.munder.20606.sbeok.shnf
update public.songs set last_played = '1985-03-31' where title = 'Viola Lee Blues' and last_played is distinct from '1985-03-31';  -- was 1970-02-14 | 1 tape(s) | gd1985-03-31.beyerm88.tsuraci.78505.sbeok.flac16
update public.songs set first_played = '1967-04-08' where title = 'Walkin Blues' and first_played is distinct from '1967-04-08';  -- was 1991-02-19 | 1 tape(s) | gd67-04-08.tv.hanno.12623.sbeok.shnf
update public.songs set last_played = '1995-07-02' where title = 'Walkin Blues' and last_played is distinct from '1995-07-02';  -- was 1995-06-30 | 10 tape(s) | gd95-07-02.aud.unk.12578.sbeok.shnf
update public.songs set first_played = '1973-10-23' where title = 'Wang Dang Doodle' and first_played is distinct from '1973-10-23';  -- was 1987-09-15 | 1 tape(s) | gd1973-10-23.sbd.miller.92792.sbeok.flac16
update public.songs set last_played = '1995-07-08' where title = 'Wang Dang Doodle' and last_played is distinct from '1995-07-08';  -- was 1995-07-02 | 9 tape(s) | gd95-07-08.sbd.10071.sbeok.shnf
update public.songs set first_played = '1992-02-23' where title = 'Way to Go Home' and first_played is distinct from '1992-02-23';  -- was 1994-10-01 | 9 tape(s) | gd92-02-23.schoeps.gardner.9982.sbeok.shnf
update public.songs set last_played = '1995-06-28' where title = 'Way to Go Home' and last_played is distinct from '1995-06-28';  -- was 1995-07-08 | 6 tape(s) | gd95-06-28.schoeps.10154.sbeok.shnf
update public.songs set first_played = '1968-01-22' where title = 'We Bid You Goodnight' and first_played is distinct from '1968-01-22';  -- was 1968-10-12 | 1 tape(s) | gd1968-01-22.sbd.miller.97342.sbeok.flac16
update public.songs set last_played = '1991-09-26' where title = 'We Bid You Goodnight' and last_played is distinct from '1991-09-26';  -- was 1995-07-09 | 10 tape(s) | gd91-09-26.sbd.fishman.21242.sbeok.shnf
update public.songs set first_played = '1972-07-21' where title = 'Weather Report Suite' and first_played is distinct from '1972-07-21';  -- was 1973-09-07 | 1 tape(s) | gd72-07-21.sbd.cotsman.9246.sbeok.shnf
update public.songs set last_played = '1974-10-18' where title = 'Weather Report Suite' and last_played is distinct from '1974-10-18';  -- was 1974-10-20 | 8 tape(s) | gd74-10-18.sbd.bertha-ashley.22796.sbeok.shnf
update public.songs set first_played = '1978-04-19' where title = 'Werewolves of London' and first_played is distinct from '1978-04-19';  -- was 1978-04-11 | 4 tape(s) | gd1978-04-19.sbd.gans.miller.9121.shnf
update public.songs set last_played = '1991-10-31' where title = 'Werewolves of London' and last_played is distinct from '1991-10-31';  -- was 1993-06-11 | 8 tape(s) | gd91-10-31.sbd.gardner.2897.sbeok.shnf
update public.songs set first_played = '1981-07-10' where title = 'West L.A. Fadeaway' and first_played is distinct from '1981-07-10';  -- was 1982-10-10 | 1 tape(s) | gd1981-07-10.sonyecm.weinberg.laura.14195.sbeok.shnf
update public.songs set last_played = '1995-06-30' where title = 'West L.A. Fadeaway' and last_played is distinct from '1995-06-30';  -- was 1995-07-09 | 8 tape(s) | gd95-06-30.schoeps.3376.sbeok.shnf
update public.songs set first_played = '1970-10-31' where title = 'Wharf Rat' and first_played is distinct from '1970-10-31';  -- was 1971-02-18 | 1 tape(s) | gd1970-10-31.153145.late.sbd.mance.hance.sirmick.flac16
update public.songs set last_played = '1995-06-25' where title = 'Wharf Rat' and last_played is distinct from '1995-06-25';  -- was 1995-07-09 | 10 tape(s) | gd95-06-25.sbd.2236.sbefail.shnf
update public.songs set last_played = '1995-07-09' where title = 'When I Paint My Masterpiece' and last_played is distinct from '1995-07-09';  -- was 1993-06-11 | 10 tape(s) | gd95-07-09.sbd.7233.sbeok.shnf
update public.songs set first_played = '1986-12-01' where title = 'When Push Comes to Shove' and first_played is distinct from '1986-12-01';  -- was 1987-09-15 | 2 tape(s) | gd1986-12-01.170842.sbd.miller.flac1648
update public.songs set last_played = '1989-07-17' where title = 'When Push Comes to Shove' and last_played is distinct from '1989-07-17';  -- was 1992-09-17 | 10 tape(s) | gd89-07-17.sbd.unknown.17702.sbeok.shnf
update public.songs set first_played = '1981-03-20' where title = 'Women Are Smarter' and first_played is distinct from '1981-03-20';  -- was 1986-03-19 | 1 tape(s) | gd1981-03-20.sndchk.aud.seaweed.113433.flac1644
update public.songs set last_played = '1995-06-21' where title = 'Women Are Smarter' and last_played is distinct from '1995-06-21';  -- was 1995-06-25 | 5 tape(s) | gd1995-06-21.Nak300CP4.Heaton.Keo.115993.Flac1644
commit;
